-- Migration 019: Employer/Mentor Role Overhaul (schema + data)
-- Run AFTER 018_employer_mentor_overhaul.sql has been committed.

-- ─── 1. Migrate existing alumni/parent rows ───────────────────────────────────
-- Old enum values (alumni, parent) cannot be dropped in Postgres without
-- recreating the type. They are left in place but will no longer be used.
UPDATE profiles SET role = 'employer_mentor' WHERE role IN ('alumni', 'parent');

-- ─── 2. Profile fields ───────────────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS mentor_type           text,
  ADD COLUMN IF NOT EXISTS mentor_type_other     text,
  ADD COLUMN IF NOT EXISTS student_seeking       text,
  ADD COLUMN IF NOT EXISTS student_seeking_other text,
  ADD COLUMN IF NOT EXISTS grade                 text,
  ADD COLUMN IF NOT EXISTS interests_other       text;

-- ─── 3. Job fields ───────────────────────────────────────────────────────────
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS opportunity_type       text,
  ADD COLUMN IF NOT EXISTS opportunity_type_other text,
  ADD COLUMN IF NOT EXISTS start_date             date,
  ADD COLUMN IF NOT EXISTS end_date               date;

-- ─── 4. student_posts table ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS student_posts (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pitch         text NOT NULL,
  seeking       text NOT NULL,
  seeking_other text,
  interests     text[] NOT NULL DEFAULT '{}',
  availability  text,
  is_closed     boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ─── 5. RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE student_posts ENABLE ROW LEVEL SECURITY;

-- Students can manage their own posts
DROP POLICY IF EXISTS "student_posts_owner" ON student_posts;
CREATE POLICY "student_posts_owner"
  ON student_posts
  FOR ALL
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

-- Anyone authenticated can read open posts (or their own closed ones)
DROP POLICY IF EXISTS "student_posts_read_open" ON student_posts;
CREATE POLICY "student_posts_read_open"
  ON student_posts
  FOR SELECT
  USING (
    is_closed = false
    OR student_id = auth.uid()
  );

-- ─── 6. Indexes ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_student_posts_student_id ON student_posts(student_id);
CREATE INDEX IF NOT EXISTS idx_student_posts_seeking    ON student_posts(seeking);
CREATE INDEX IF NOT EXISTS idx_student_posts_is_closed  ON student_posts(is_closed);
