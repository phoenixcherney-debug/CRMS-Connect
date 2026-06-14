-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 086: applications.status_changed_at (I1)
--
-- Application notifications were keyed to created_at (submission time), so a
-- later accept/reject never surfaced as "new" on /notifications — a student
-- could miss the outcome. Track when the status last changed and key the
-- notification freshness off that instead.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz;

-- Backfill existing rows to their creation time (best available proxy).
UPDATE public.applications SET status_changed_at = created_at WHERE status_changed_at IS NULL;

ALTER TABLE public.applications ALTER COLUMN status_changed_at SET DEFAULT now();

-- Stamp the column whenever status actually changes.
CREATE OR REPLACE FUNCTION public.applications_stamp_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_changed_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS applications_stamp_status_change ON public.applications;
CREATE TRIGGER applications_stamp_status_change
  BEFORE UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.applications_stamp_status_change();

NOTIFY pgrst, 'reload schema';
