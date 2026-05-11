-- 076_community_stats_v2.sql
-- Task 5 — extend the community_stats() RPC introduced in 071 to be
-- the single source of truth for every page that shows a headcount.
--
-- Definitions (kept in sync with lib/stats.ts):
--   members              — all non-deleted, non-admin profiles
--   students             — role=student, profile completed (interests >= 1)
--   mentors              — role=employer_mentor and open_to_mentorship=true
--   companies            — distinct, trimmed, non-blank `company` values
--                          across active non-draft jobs
--   opportunities_active — jobs where is_active=true AND
--                          (deadline IS NULL OR deadline >= today)

CREATE OR REPLACE FUNCTION public.community_stats()
RETURNS TABLE (
  members              BIGINT,
  students             BIGINT,
  mentors              BIGINT,
  companies            BIGINT,
  opportunities_active BIGINT
) LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT
    (SELECT count(*) FROM public.profiles
       WHERE role <> 'admin'
         AND coalesce(banned_at, 'epoch'::timestamptz) <= 'epoch'::timestamptz
    ) AS members,
    (SELECT count(*) FROM public.profiles
       WHERE role = 'student'
         AND coalesce(array_length(interests, 1), 0) >= 1
         AND coalesce(banned_at, 'epoch'::timestamptz) <= 'epoch'::timestamptz
    ) AS students,
    (SELECT count(*) FROM public.profiles
       WHERE role = 'employer_mentor'
         AND open_to_mentorship = TRUE
         AND coalesce(banned_at, 'epoch'::timestamptz) <= 'epoch'::timestamptz
    ) AS mentors,
    (SELECT count(DISTINCT btrim(company)) FROM public.jobs
       WHERE is_active = TRUE
         AND coalesce(is_draft, FALSE) = FALSE
         AND company IS NOT NULL
         AND btrim(company) <> ''
    ) AS companies,
    (SELECT count(*) FROM public.jobs
       WHERE is_active = TRUE
         AND coalesce(is_draft, FALSE) = FALSE
         AND (deadline IS NULL OR deadline >= current_date)
    ) AS opportunities_active;
$$;

REVOKE ALL ON FUNCTION public.community_stats() FROM public;
GRANT EXECUTE ON FUNCTION public.community_stats() TO anon, authenticated;
