-- ============================================================
-- CRMS Connect — Migration 003: Bug Fixes
-- Run this in: Supabase Dashboard → Database → SQL Editor
-- ============================================================

-- ─── Fix 1: Order-independent conversation uniqueness ────────────────────────
-- The original UNIQUE(participant_one, participant_two) treats (A,B) and (B,A)
-- as different rows, allowing duplicate conversations between the same two users.
-- Replace it with an expression index on LEAST/GREATEST so (A,B) == (B,A).

ALTER TABLE conversations
  DROP CONSTRAINT IF EXISTS conversations_participant_one_participant_two_key;

CREATE UNIQUE INDEX IF NOT EXISTS conversations_participants_uniq
  ON conversations (
    LEAST(participant_one, participant_two),
    GREATEST(participant_one, participant_two)
  );

-- ─── Fix 2: Applications can only be inserted by students ────────────────────
-- The original policy only checked auth.uid() = applicant_id but not the role,
-- allowing alumni/parent users to apply via the API even though the UI hides it.

DROP POLICY IF EXISTS "applications_insert_own" ON applications;

CREATE POLICY "applications_insert_own"
  ON applications FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = applicant_id
    AND (
      SELECT role FROM profiles WHERE id = auth.uid()
    ) = 'student'
  );

-- ─── Note on is_active / close_expired_jobs() ────────────────────────────────
-- The close_expired_jobs() function (migration 001) requires pg_cron to run
-- automatically. Without it, is_active stays TRUE past the deadline.
-- The client already handles this correctly by checking deadline client-side:
--   expired = isPast(parseISO(job.deadline))
-- Treat is_active as a manual "poster deactivated" flag only.
-- To schedule auto-close with pg_cron (optional):
--   SELECT cron.schedule('close-expired-jobs', '0 2 * * *', 'SELECT close_expired_jobs()');
