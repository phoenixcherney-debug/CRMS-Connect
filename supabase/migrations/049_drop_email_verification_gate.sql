-- 049_drop_email_verification_gate.sql
-- Reverses migration 042 (the RLS verification gate) and updates 045
-- so the directory member count no longer filters on
-- auth.users.email_confirmed_at.
--
-- Rationale: product called this off — verification was friction users
-- were hitting with no payoff matching the school's signup flow. The
-- frontend gate (ProtectedRoute redirect to /verify-email) and the
-- VerifyEmail page have been removed in the same change.

-- ── Drop the RESTRICTIVE policies from 042 ──────────────────────────────
DROP POLICY IF EXISTS verified_required_messages_insert         ON public.messages;
DROP POLICY IF EXISTS verified_required_applications_insert     ON public.applications;
DROP POLICY IF EXISTS verified_required_conversations_insert    ON public.conversations;
DROP POLICY IF EXISTS verified_required_meeting_requests_insert ON public.meeting_requests;
DROP POLICY IF EXISTS verified_required_student_posts_insert    ON public.student_posts;
DROP POLICY IF EXISTS verified_required_jobs_insert             ON public.jobs;
DROP POLICY IF EXISTS verified_required_profiles_select         ON public.profiles;

-- ── Drop the helper function ────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.is_email_verified();

-- ── Update directory_member_count to drop the email_confirmed_at filter ──
CREATE OR REPLACE FUNCTION public.directory_member_count()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::int
    FROM public.profiles p
   WHERE p.role <> 'admin'
     AND p.banned_at IS NULL
     AND p.account_status NOT IN ('pending', 'disabled');
$$;

COMMENT ON FUNCTION public.directory_member_count() IS
  'Count of directory-visible members. Excludes admins, banned, and pending/disabled E/M. Email verification is no longer a filter.';
