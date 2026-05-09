-- 042_email_verification_gate.sql
-- C-05 — server-side enforcement of email verification.
--
-- The frontend already redirects unverified users to /verify-email via
-- ProtectedRoute, but a hand-crafted REST call could still hit the DB
-- directly. This migration enforces verification at the RLS layer so the
-- gate cannot be bypassed.
--
-- Strategy:
--   1. Add a SECURITY DEFINER helper public.is_email_verified() that
--      reads auth.users.email_confirmed_at for the current auth.uid().
--   2. Layer RESTRICTIVE policies on the write paths that should be
--      gated. RESTRICTIVE policies AND with the existing PERMISSIVE
--      ones, so this complements the role / ownership checks already
--      in place rather than replacing them.
--   3. Cross-row SELECT on profiles is also gated so unverified users
--      can't browse the directory; users can still read their OWN row
--      (so /profile keeps working), and admins are exempt.

CREATE OR REPLACE FUNCTION public.is_email_verified()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM auth.users
     WHERE id = auth.uid()
       AND email_confirmed_at IS NOT NULL
  );
$$;

COMMENT ON FUNCTION public.is_email_verified() IS
  'Returns true iff the current auth.uid() has a non-null email_confirmed_at. Used by RLS to gate write paths and directory reads on unverified accounts.';

-- ── Write paths gated on verification ────────────────────────────────────────
-- RESTRICTIVE policies AND with existing permissive ones; admins bypass via
-- public.is_admin() exit so platform-side automation is not blocked.

CREATE POLICY verified_required_messages_insert
  ON public.messages          AS RESTRICTIVE  FOR INSERT
  WITH CHECK (public.is_admin() OR public.is_email_verified());

CREATE POLICY verified_required_applications_insert
  ON public.applications      AS RESTRICTIVE  FOR INSERT
  WITH CHECK (public.is_admin() OR public.is_email_verified());

CREATE POLICY verified_required_conversations_insert
  ON public.conversations     AS RESTRICTIVE  FOR INSERT
  WITH CHECK (public.is_admin() OR public.is_email_verified());

CREATE POLICY verified_required_meeting_requests_insert
  ON public.meeting_requests  AS RESTRICTIVE  FOR INSERT
  WITH CHECK (public.is_admin() OR public.is_email_verified());

CREATE POLICY verified_required_student_posts_insert
  ON public.student_posts     AS RESTRICTIVE  FOR INSERT
  WITH CHECK (public.is_admin() OR public.is_email_verified());

CREATE POLICY verified_required_jobs_insert
  ON public.jobs              AS RESTRICTIVE  FOR INSERT
  WITH CHECK (public.is_admin() OR public.is_email_verified());

-- ── Directory read gated on verification ─────────────────────────────────────
-- Unverified users can still read their OWN profile row (needed for /profile
-- and the verify interstitial), but cross-row reads of other people are
-- blocked until they verify.

CREATE POLICY verified_required_profiles_select
  ON public.profiles          AS RESTRICTIVE  FOR SELECT
  USING (
    id = auth.uid()
    OR public.is_admin()
    OR public.is_email_verified()
  );
