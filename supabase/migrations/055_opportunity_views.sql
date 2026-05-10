-- 055_opportunity_views.sql
-- P2-16 — view-event log for /opportunities/:id detail-page hits, scoped
-- to authenticated students (the owner's own visits don't count). Used
-- by the My Opportunities row stats and the per-post drilldown.
--
-- Schema is minimal: one row per page-load, with the source surface so
-- we can break down traffic ('explore', 'opportunities', 'student-posts',
-- 'direct').

CREATE TABLE IF NOT EXISTS public.opportunity_views (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      UUID         NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  viewer_id   UUID         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source      TEXT         NOT NULL DEFAULT 'direct'
                            CHECK (source IN ('explore','opportunities','student-posts','feed','direct','saved','employer','notification')),
  viewed_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_opportunity_views_job_time
  ON public.opportunity_views (job_id, viewed_at DESC);

ALTER TABLE public.opportunity_views ENABLE ROW LEVEL SECURITY;

-- Inserts: any authenticated user who is NOT the job's owner can record
-- a view of their own. Self-views are rejected so the count isn't padded
-- by the employer reloading their own page.
DROP POLICY IF EXISTS opportunity_views_insert_self ON public.opportunity_views;
CREATE POLICY opportunity_views_insert_self
  ON public.opportunity_views FOR INSERT
  WITH CHECK (
    auth.uid() = viewer_id
    AND auth.uid() <> (SELECT posted_by FROM public.jobs WHERE id = job_id)
  );

-- Selects: only the job owner (or admin) can read view rows. Even the
-- viewer can't read their own — privacy.
DROP POLICY IF EXISTS opportunity_views_select_owner ON public.opportunity_views;
CREATE POLICY opportunity_views_select_owner
  ON public.opportunity_views FOR SELECT
  USING (
    public.is_admin()
    OR auth.uid() = (SELECT posted_by FROM public.jobs WHERE id = job_id)
  );

-- Aggregate counts as a SECURITY DEFINER RPC so the My Opportunities row
-- can fetch one row per job with a single round-trip.
CREATE OR REPLACE FUNCTION public.opportunity_view_stats(job_ids UUID[])
RETURNS TABLE (
  job_id          UUID,
  views_30d       BIGINT,
  unique_viewers_30d BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    v.job_id,
    count(*) AS views_30d,
    count(DISTINCT v.viewer_id) AS unique_viewers_30d
  FROM public.opportunity_views v
  WHERE v.job_id = ANY(job_ids)
    AND v.viewed_at >= now() - interval '30 days'
    -- Same RLS-equivalent gate: caller must own each job.
    AND (
      public.is_admin()
      OR auth.uid() = (SELECT posted_by FROM public.jobs WHERE id = v.job_id)
    )
  GROUP BY v.job_id;
$$;

GRANT EXECUTE ON FUNCTION public.opportunity_view_stats(UUID[]) TO authenticated;
