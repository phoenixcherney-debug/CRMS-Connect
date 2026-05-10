-- 060_extend_opportunity_stats.sql
-- P1-5 — extend the per-opportunity stats RPC with save_count and the
-- first-applicant timestamp so the My Opportunities row can show
-- "N saves · first applicant in 2d" without extra round-trips.
--
-- Drop+recreate because RETURNS TABLE signatures aren't ALTER-able.

DROP FUNCTION IF EXISTS public.opportunity_view_stats(UUID[]);

CREATE OR REPLACE FUNCTION public.opportunity_view_stats(job_ids UUID[])
RETURNS TABLE (
  job_id              UUID,
  views_30d           BIGINT,
  unique_viewers_30d  BIGINT,
  save_count          BIGINT,
  first_applicant_at  TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    j.id AS job_id,
    COALESCE((
      SELECT count(*)::bigint
        FROM public.opportunity_views v
       WHERE v.job_id = j.id
         AND v.viewed_at >= now() - interval '30 days'
    ), 0) AS views_30d,
    COALESCE((
      SELECT count(DISTINCT v.viewer_id)::bigint
        FROM public.opportunity_views v
       WHERE v.job_id = j.id
         AND v.viewed_at >= now() - interval '30 days'
    ), 0) AS unique_viewers_30d,
    COALESCE((
      SELECT count(*)::bigint FROM public.saved_jobs s WHERE s.job_id = j.id
    ), 0) AS save_count,
    (
      SELECT min(a.created_at)
        FROM public.applications a
       WHERE a.job_id = j.id
    ) AS first_applicant_at
  FROM unnest(job_ids) WITH ORDINALITY AS t(id, ord)
  JOIN public.jobs j ON j.id = t.id
  WHERE public.is_admin() OR auth.uid() = j.posted_by;
$$;

GRANT EXECUTE ON FUNCTION public.opportunity_view_stats(UUID[]) TO authenticated;
