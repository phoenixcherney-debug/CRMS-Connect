-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 022: Admin role, banned_at, RLS updates, and admin action functions
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Extend enum ───────────────────────────────────────────────────────────
-- NOTE: If running manually in the SQL Editor, run this line first in its own
-- statement before the rest, as ADD VALUE cannot run inside a transaction block.
ALTER TYPE role_type ADD VALUE IF NOT EXISTS 'admin';

-- ── 2. Add banned_at column to profiles ─────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ DEFAULT NULL;

-- ── 3. is_admin() helper ────────────────────────────────────────────────────
-- Used inside RLS policies and action functions.
-- STABLE so Postgres can cache the result within a single query.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
END;
$$;

-- ── 4. Update email validation trigger to skip admin ─────────────────────────
-- The trigger only fires on INSERT, so promoting via UPDATE is already safe.
-- This guard is a forward-safety measure in case someone sets role='admin'
-- in signup metadata directly.
CREATE OR REPLACE FUNCTION public.validate_profile_email_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  user_email TEXT;
BEGIN
  -- Admin accounts bypass all email-domain validation
  IF NEW.role = 'admin' THEN
    RETURN NEW;
  END IF;

  SELECT email INTO user_email FROM auth.users WHERE id = NEW.id;

  IF NEW.role = 'student' AND lower(user_email) NOT LIKE '%@crms.org' THEN
    RAISE EXCEPTION 'Student accounts require a @crms.org school email address.';
  END IF;

  IF NEW.role IN ('alumni', 'parent', 'employer_mentor')
     AND lower(user_email) LIKE '%@crms.org' THEN
    RAISE EXCEPTION 'Please use a personal email address, not your school email.';
  END IF;

  RETURN NEW;
END;
$$;

-- ── 5. profiles UPDATE: allow admin to update any profile ───────────────────
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own_or_admin"
  ON profiles FOR UPDATE
  TO authenticated
  USING  (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());

-- ── 6. jobs SELECT: admin sees all ──────────────────────────────────────────
DROP POLICY IF EXISTS "jobs_select_authenticated" ON jobs;
CREATE POLICY "jobs_select_authenticated"
  ON jobs FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR auth.uid() = posted_by
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'student'
  );

-- ── 7. jobs DELETE: admin can delete any job ────────────────────────────────
DROP POLICY IF EXISTS "jobs_delete_own" ON jobs;
CREATE POLICY "jobs_delete_own_or_admin"
  ON jobs FOR DELETE
  TO authenticated
  USING (auth.uid() = posted_by OR public.is_admin());

-- ── 8. applications SELECT: admin sees all ──────────────────────────────────
DROP POLICY IF EXISTS "applications_select" ON applications;
CREATE POLICY "applications_select"
  ON applications FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR auth.uid() = applicant_id
    OR auth.uid() = (SELECT posted_by FROM public.jobs WHERE id = job_id)
  );

-- ── 9. student_posts SELECT: admin sees all including closed ─────────────────
DROP POLICY IF EXISTS "student_posts_read_open" ON student_posts;
CREATE POLICY "student_posts_read_open_or_admin"
  ON student_posts FOR SELECT
  USING (
    public.is_admin()
    OR is_closed = false
    OR student_id = auth.uid()
  );

-- ── 10. Admin action functions ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_ban_user(target_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;
  IF target_id = auth.uid() THEN
    RAISE EXCEPTION 'Admin cannot ban themselves';
  END IF;
  UPDATE public.profiles SET banned_at = now() WHERE id = target_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_unban_user(target_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;
  UPDATE public.profiles SET banned_at = NULL WHERE id = target_id;
END;
$$;

-- ── 11. admin_list_users() — all profiles with email from auth.users ─────────
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  id                  UUID,
  full_name           TEXT,
  role                TEXT,
  created_at          TIMESTAMPTZ,
  banned_at           TIMESTAMPTZ,
  onboarding_complete BOOLEAN,
  email               TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;
  RETURN QUERY
    SELECT
      p.id,
      p.full_name,
      p.role::TEXT,
      p.created_at,
      p.banned_at,
      p.onboarding_complete,
      u.email
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    ORDER BY p.created_at DESC;
END;
$$;

-- ── 12. admin_get_user_email() — single user's email ────────────────────────
CREATE OR REPLACE FUNCTION public.admin_get_user_email(target_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;
  RETURN (SELECT email FROM auth.users WHERE id = target_id);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- HOW TO BECOME ADMIN
-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Sign up normally through the app (any email, any role is fine)
-- 2. Run this in Supabase Dashboard → SQL Editor (replace with your email):
--
--   UPDATE public.profiles
--   SET role = 'admin'
--   WHERE id = (SELECT id FROM auth.users WHERE email = 'your@email.com');
--
-- The email validation trigger only fires on INSERT, not UPDATE, so this
-- is safe regardless of your email domain.
-- ─────────────────────────────────────────────────────────────────────────────

NOTIFY pgrst, 'reload schema';
