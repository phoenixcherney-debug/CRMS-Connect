-- 050_drop_approval_gate.sql
-- Tear out the E/M approval gate added in migration 033.
--
-- New employer/mentor signups should land on /explore immediately rather
-- than the awaiting-approval interstitial. This migration:
--
--   1. Drops the BEFORE INSERT trigger that auto-flipped new E/M rows to
--      account_status='pending'.
--   2. Re-activates every account currently sitting in 'pending' so none
--      of them stay locked out post-deploy.
--   3. Drops the seven RESTRICTIVE pending_block_* policies that used
--      public.is_active_or_admin() to gate writes on the gate.
--
-- The `account_status` column and the `is_active_or_admin()` helper stay
-- in place — `account_status='disabled'` is still used by the admin
-- ban-from-report flow (AdminReports.tsx).

-- ── 1. Stop putting new accounts into 'pending' ─────────────────────────
DROP TRIGGER IF EXISTS profiles_default_account_status ON public.profiles;
DROP FUNCTION IF EXISTS public.profiles_default_account_status_trg();

-- ── 2. Unblock anyone currently waiting ─────────────────────────────────
UPDATE public.profiles
   SET account_status = 'active'
 WHERE account_status = 'pending';

-- ── 3. Drop the RESTRICTIVE policies that gated writes on the gate ──────
DROP POLICY IF EXISTS pending_block_messages_insert         ON public.messages;
DROP POLICY IF EXISTS pending_block_conversations_insert    ON public.conversations;
DROP POLICY IF EXISTS pending_block_applications_insert     ON public.applications;
DROP POLICY IF EXISTS pending_block_jobs_insert             ON public.jobs;
DROP POLICY IF EXISTS pending_block_student_posts_insert    ON public.student_posts;
DROP POLICY IF EXISTS pending_block_events_insert           ON public.events;
DROP POLICY IF EXISTS pending_block_meeting_req_insert      ON public.meeting_requests;
