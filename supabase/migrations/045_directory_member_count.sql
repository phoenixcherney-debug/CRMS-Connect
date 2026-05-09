-- 045_directory_member_count.sql
-- H-06 — the /explore "Members" count must exclude users who have not
-- yet verified their email (and, for E/M, who are still pending or
-- disabled). The client cannot filter on auth.users.email_confirmed_at
-- directly (no RLS access to auth schema), so expose a small
-- SECURITY DEFINER function.

CREATE OR REPLACE FUNCTION public.directory_member_count()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::int
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
   WHERE p.role <> 'admin'
     AND p.banned_at IS NULL
     AND p.account_status NOT IN ('pending', 'disabled')
     AND u.email_confirmed_at IS NOT NULL;
$$;

COMMENT ON FUNCTION public.directory_member_count() IS
  'Count of directory-visible members. Excludes admins, banned, pending/disabled E/M, and unverified accounts. Used by /explore stats.';

GRANT EXECUTE ON FUNCTION public.directory_member_count() TO authenticated, anon;
