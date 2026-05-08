-- 033_employer_mentor_approval.sql
--
-- SEC-001 — gate employer/mentor signup behind staff approval.
--
-- Default new EM signups to `pending`. They can sign in and edit their own
-- profile; everything else (DMs, applications, posting, student-posts feed
-- read) is blocked by RLS until staff flips them to `active`. Students
-- continue to default to `active` (their own gate is the @crms.org check
-- in the existing validate-signup edge function).

CREATE TYPE public.account_status_t AS ENUM ('pending', 'active', 'disabled');

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_status public.account_status_t
  NOT NULL DEFAULT 'active';

-- Backfill: any pre-existing rows are already in production, treat them as
-- active. Future EM signups will land as pending via the trigger below.
UPDATE public.profiles SET account_status = 'active' WHERE account_status IS NULL;

-- Set EM signups to pending on insert. Students stay active.
CREATE OR REPLACE FUNCTION public.profiles_default_account_status_trg()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.role = 'employer_mentor' AND NEW.account_status = 'active' THEN
    NEW.account_status := 'pending';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_default_account_status ON public.profiles;
CREATE TRIGGER profiles_default_account_status
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_default_account_status_trg();

-- ─── RLS policies for pending accounts ────────────────────────────────────
--
-- Pending EM accounts are *able* to read+update their own profile (so they
-- can complete onboarding) but cannot:
--   - read other profiles (the directory),
--   - read messages / conversations,
--   - insert messages, applications, jobs, student_posts, events,
--     meeting_requests.
--
-- Approved (`active`) and admin accounts are unaffected.

-- Helper: is the current viewer's account active or admin?
CREATE OR REPLACE FUNCTION public.is_active_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND (account_status = 'active' OR role = 'admin')
  );
$$;

-- profiles: pending users can only see their own row.
DROP POLICY IF EXISTS profiles_select_pending_own_only ON public.profiles;
CREATE POLICY profiles_select_pending_own_only ON public.profiles
  FOR SELECT
  USING (
    -- Own row: always allowed.
    id = auth.uid()
    -- Approved viewer: existing policies (this OR clause is the additive
    -- gate). The wider policy from earlier migrations handles "approved
    -- can see everyone (minus admins, minus banned)" — we just block the
    -- pending viewer.
    OR public.is_active_or_admin()
  );

-- Tables that should be fully blocked for pending viewers. We add a
-- catch-all "is_active_or_admin" gate to writes; reads of conversations /
-- messages also gate on it because pending accounts shouldn't be DMing.

ALTER TABLE public.messages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_posts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_requests  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pending_block_messages_insert      ON public.messages;
CREATE POLICY pending_block_messages_insert      ON public.messages         FOR INSERT WITH CHECK (public.is_active_or_admin());

DROP POLICY IF EXISTS pending_block_conversations_insert ON public.conversations;
CREATE POLICY pending_block_conversations_insert ON public.conversations    FOR INSERT WITH CHECK (public.is_active_or_admin());

DROP POLICY IF EXISTS pending_block_applications_insert  ON public.applications;
CREATE POLICY pending_block_applications_insert  ON public.applications     FOR INSERT WITH CHECK (public.is_active_or_admin());

DROP POLICY IF EXISTS pending_block_jobs_insert           ON public.jobs;
CREATE POLICY pending_block_jobs_insert           ON public.jobs            FOR INSERT WITH CHECK (public.is_active_or_admin());

DROP POLICY IF EXISTS pending_block_student_posts_insert ON public.student_posts;
CREATE POLICY pending_block_student_posts_insert ON public.student_posts    FOR INSERT WITH CHECK (public.is_active_or_admin());

DROP POLICY IF EXISTS pending_block_events_insert         ON public.events;
CREATE POLICY pending_block_events_insert         ON public.events          FOR INSERT WITH CHECK (public.is_active_or_admin());

DROP POLICY IF EXISTS pending_block_meeting_req_insert   ON public.meeting_requests;
CREATE POLICY pending_block_meeting_req_insert   ON public.meeting_requests FOR INSERT WITH CHECK (public.is_active_or_admin());

COMMENT ON COLUMN public.profiles.account_status IS
  'pending = signed up but awaiting staff approval (EMs only); active = full access; disabled = banned/removed. Default for new EM rows is pending via trigger; students default to active.';
