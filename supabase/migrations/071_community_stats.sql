-- 071_community_stats.sql
-- Phase 4.4 — community-stat strip on public pages. Counts only,
-- nothing identifying. Anon-callable via a SECURITY DEFINER RPC so we
-- don't have to widen any table-level RLS.

CREATE OR REPLACE FUNCTION public.community_stats()
RETURNS TABLE (
  active_mentors      BIGINT,
  active_students     BIGINT,
  active_opportunities BIGINT
) LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT
    (SELECT count(*) FROM public.profiles
       WHERE role = 'employer_mentor'
         AND open_to_mentorship = TRUE
         AND coalesce(banned_at, 'epoch'::timestamptz) <= 'epoch'::timestamptz
    ) AS active_mentors,
    (SELECT count(*) FROM public.profiles
       WHERE role = 'student'
         AND coalesce(banned_at, 'epoch'::timestamptz) <= 'epoch'::timestamptz
    ) AS active_students,
    (SELECT count(*) FROM public.jobs
       WHERE is_active = TRUE
         AND coalesce(is_draft, FALSE) = FALSE
    ) AS active_opportunities;
$$;

REVOKE ALL ON FUNCTION public.community_stats() FROM public;
GRANT EXECUTE ON FUNCTION public.community_stats() TO anon, authenticated;
