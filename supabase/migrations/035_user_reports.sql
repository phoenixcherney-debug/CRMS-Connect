-- 035_user_reports.sql
--
-- SEC-003 — report-user flow. Anyone can submit a report; staff
-- triages them on /admin/reports. Rate-limited to 1 per (reporter,
-- target) per 24h to discourage spam.

CREATE TYPE public.user_report_status_t AS ENUM ('open', 'reviewed', 'actioned');

CREATE TABLE IF NOT EXISTS public.user_reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL CHECK (length(reason) BETWEEN 1 AND 500),
  status      public.user_report_status_t NOT NULL DEFAULT 'open',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.profiles(id),
  CHECK (reporter_id <> reported_id)
);

CREATE INDEX IF NOT EXISTS user_reports_reported_idx ON public.user_reports(reported_id);
CREATE INDEX IF NOT EXISTS user_reports_status_idx ON public.user_reports(status, created_at DESC);

-- Rate limit at the DB level: a partial unique index over a 24h window
-- isn't expressible directly, so we lean on app-level enforcement plus
-- a simple "no two reports from the same reporter against the same target
-- with status=open at once" constraint.
CREATE UNIQUE INDEX IF NOT EXISTS user_reports_one_open_per_pair
  ON public.user_reports(reporter_id, reported_id)
  WHERE status = 'open';

ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can insert a report (subject to the
-- one-open-per-pair index + the active gate from migration 033).
DROP POLICY IF EXISTS user_reports_insert_authed ON public.user_reports;
CREATE POLICY user_reports_insert_authed ON public.user_reports
  FOR INSERT
  WITH CHECK (
    auth.uid() = reporter_id
    AND public.is_active_or_admin()
  );

-- Reporters can see their own submissions; admins see all.
DROP POLICY IF EXISTS user_reports_select_self_or_admin ON public.user_reports;
CREATE POLICY user_reports_select_self_or_admin ON public.user_reports
  FOR SELECT
  USING (
    reporter_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Only admins can update (status transitions).
DROP POLICY IF EXISTS user_reports_update_admin ON public.user_reports;
CREATE POLICY user_reports_update_admin ON public.user_reports
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- The sanitizer trigger from migration 032 covers `reason`.
CREATE OR REPLACE FUNCTION public.user_reports_sanitize_trg()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.reason := public.crms_clean_text(NEW.reason);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS user_reports_sanitize ON public.user_reports;
CREATE TRIGGER user_reports_sanitize BEFORE INSERT OR UPDATE ON public.user_reports
  FOR EACH ROW EXECUTE FUNCTION public.user_reports_sanitize_trg();
