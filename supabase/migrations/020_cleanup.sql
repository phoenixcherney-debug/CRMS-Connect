-- ─────────────────────────────────────────────────────────────────────────────
-- 020_cleanup.sql
-- Removes zombie columns, dead tables, and outdated policies accumulated
-- across earlier migrations; adds missing quality-of-life columns.
-- Safe to run once on the live database.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. profiles: add notifications_seen_at if not already present ─────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS notifications_seen_at timestamptz;

-- ── 2. profiles: SELECT policy is recreated in step 9 after deleted_at is dropped ──
-- (no-op here — the policy rebuild happens alongside the column drop below)

-- ── 3. profiles: allow users to update their own row ─────────────────────────
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ── 4. Drop zombie columns from jobs ─────────────────────────────────────────
-- capacity, required_skills, applicant_count were never used in the UI
ALTER TABLE jobs
  DROP COLUMN IF EXISTS capacity,
  DROP COLUMN IF EXISTS required_skills,
  DROP COLUMN IF EXISTS applicant_count;

-- ── 5. Drop is_pinned from jobs (replaced by pinned_jobs table, itself removed below) ──
ALTER TABLE jobs
  DROP COLUMN IF EXISTS is_pinned;

-- ── 6. Drop pinned_jobs table ─────────────────────────────────────────────────
DROP TABLE IF EXISTS pinned_jobs CASCADE;

-- ── 7. Drop follows table ─────────────────────────────────────────────────────
DROP TABLE IF EXISTS follows CASCADE;

-- ── 8. Drop delete / recover account functions ───────────────────────────────
DROP FUNCTION IF EXISTS delete_own_account() CASCADE;
DROP FUNCTION IF EXISTS recover_own_account(text) CASCADE;

-- ── 9. Drop soft-delete trigger on profiles (deleted_at column also removed) ──
-- Must drop the SELECT policy first because it references deleted_at,
-- then drop the column, then recreate the policy without deleted_at.
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON profiles;
DROP TRIGGER  IF EXISTS on_profile_delete ON profiles;
DROP FUNCTION IF EXISTS handle_profile_delete() CASCADE;
ALTER TABLE profiles DROP COLUMN IF EXISTS deleted_at;

-- Recreate SELECT policy without deleted_at
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON profiles;
CREATE POLICY "Profiles are viewable by authenticated users"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

-- ── 10. student_posts: fix FK to point at profiles instead of auth.users ─────
-- If the FK already references profiles this is a no-op; if it references
-- auth.users we drop and recreate it.
ALTER TABLE student_posts
  DROP CONSTRAINT IF EXISTS student_posts_student_id_fkey;
ALTER TABLE student_posts
  ADD CONSTRAINT student_posts_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- ── 11. avatars storage bucket (created via Supabase dashboard / Storage API, ──
--        but we can set up RLS policies here for the bucket rows)
-- NOTE: The bucket itself must be created via the Supabase dashboard or Storage
-- API (INSERT INTO storage.buckets is restricted to service-role).
-- The policies below assume the bucket named 'avatars' already exists.

-- Anyone authenticated can read avatar objects
DROP POLICY IF EXISTS "Avatar objects are publicly readable" ON storage.objects;
CREATE POLICY "Avatar objects are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Users can only write to their own folder  (<user_id>/*)
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
CREATE POLICY "Users can delete their own avatar"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── 12. pg_cron note ──────────────────────────────────────────────────────────
-- To auto-close expired jobs daily, enable pg_cron in the Supabase dashboard
-- (Database → Extensions) and run:
--
--   SELECT cron.schedule(
--     'close-expired-jobs',
--     '0 0 * * *',   -- midnight UTC every day
--     $$
--       UPDATE jobs
--       SET is_active = false
--       WHERE is_active = true
--         AND deadline IS NOT NULL
--         AND deadline < current_date;
--     $$
--   );
--
-- This is intentionally left as a comment rather than executed here because
-- pg_cron may not be enabled on all environments.
