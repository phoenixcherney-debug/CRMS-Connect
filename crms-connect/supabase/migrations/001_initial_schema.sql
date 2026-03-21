-- ============================================================
-- CRMS Connect — Initial Schema
-- Run this in: Supabase Dashboard → Database → SQL Editor
-- ============================================================

-- ─── Extensions ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Enums ──────────────────────────────────────────────────
CREATE TYPE role_type AS ENUM ('student', 'alumni', 'parent');
CREATE TYPE job_type_enum AS ENUM ('internship', 'part-time', 'full-time', 'volunteer');
CREATE TYPE application_status AS ENUM ('pending', 'reviewed', 'accepted', 'rejected');

-- ─── Profiles ───────────────────────────────────────────────
CREATE TABLE profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name       TEXT NOT NULL,
  role            role_type NOT NULL,
  graduation_year INTEGER,
  bio             TEXT,
  avatar_url      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ─── Jobs ───────────────────────────────────────────────────
CREATE TABLE jobs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  posted_by     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  company       TEXT NOT NULL,
  location      TEXT NOT NULL,
  job_type      job_type_enum NOT NULL,
  description   TEXT NOT NULL,
  how_to_apply  TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  deadline      DATE NOT NULL,
  is_active     BOOLEAN DEFAULT TRUE NOT NULL
);

-- ─── Applications ───────────────────────────────────────────
CREATE TABLE applications (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  job_id       UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  applicant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  cover_note   TEXT NOT NULL,
  resume_link  TEXT,
  status       application_status DEFAULT 'pending' NOT NULL,
  UNIQUE(job_id, applicant_id)
);

-- ─── Conversations ──────────────────────────────────────────
CREATE TABLE conversations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  participant_one UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  participant_two UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  UNIQUE(participant_one, participant_two)
);

-- ─── Messages ───────────────────────────────────────────────
CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content         TEXT NOT NULL,
  is_read         BOOLEAN DEFAULT FALSE NOT NULL
);

-- Index for message lookups by conversation
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX idx_jobs_posted_by ON jobs(posted_by);
CREATE INDEX idx_jobs_is_active ON jobs(is_active, deadline);
CREATE INDEX idx_applications_job_id ON applications(job_id);
CREATE INDEX idx_applications_applicant_id ON applications(applicant_id);

-- ─── Auto-close Expired Jobs ────────────────────────────────
-- This function closes jobs past their deadline.
-- Call it via a pg_cron job: SELECT cron.schedule('0 2 * * *', 'SELECT close_expired_jobs()');
CREATE OR REPLACE FUNCTION close_expired_jobs()
RETURNS void AS $$
BEGIN
  UPDATE jobs
  SET is_active = FALSE
  WHERE deadline < CURRENT_DATE AND is_active = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Server-side Email/Role Validation ──────────────────────
-- This trigger fires before a profile is inserted and validates
-- that the user's email domain matches their chosen role.
CREATE OR REPLACE FUNCTION validate_profile_email_role()
RETURNS TRIGGER AS $$
DECLARE
  user_email TEXT;
BEGIN
  SELECT email INTO user_email FROM auth.users WHERE id = NEW.id;

  IF NEW.role = 'student' AND lower(user_email) NOT LIKE '%@crms.org' THEN
    RAISE EXCEPTION 'Student accounts require a @crms.org school email address.';
  END IF;

  IF NEW.role IN ('alumni', 'parent') AND lower(user_email) LIKE '%@crms.org' THEN
    RAISE EXCEPTION 'Please use a personal email address, not your school email.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER validate_profile_before_insert
  BEFORE INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION validate_profile_email_role();

-- ─── Auto-create Profile on Signup ──────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    (NEW.raw_user_meta_data->>'role')::role_type
  );
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- If profile creation fails (e.g. validation), we let the error propagate
    -- so the client knows the signup was rejected.
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── Enable Row Level Security ───────────────────────────────
ALTER TABLE profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages     ENABLE ROW LEVEL SECURITY;

-- ─── Profiles RLS ────────────────────────────────────────────
-- Any authenticated user can read profiles (needed for displaying names, etc.)
CREATE POLICY "profiles_select_authenticated"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

-- Users may only update their own profile
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- The auto-create trigger uses SECURITY DEFINER so INSERT is handled by the trigger.
-- We allow INSERT from the service role (used by the trigger function).
CREATE POLICY "profiles_insert_trigger"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- ─── Jobs RLS ────────────────────────────────────────────────
-- All authenticated users can read all jobs
CREATE POLICY "jobs_select_authenticated"
  ON jobs FOR SELECT
  TO authenticated
  USING (true);

-- Only alumni/parent roles can create job posts
CREATE POLICY "jobs_insert_alumni_parent"
  ON jobs FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = posted_by
    AND (
      SELECT role FROM profiles WHERE id = auth.uid()
    ) IN ('alumni', 'parent')
  );

-- Only the job poster can update their own jobs
CREATE POLICY "jobs_update_own"
  ON jobs FOR UPDATE
  TO authenticated
  USING (auth.uid() = posted_by)
  WITH CHECK (auth.uid() = posted_by);

-- Only the job poster can delete their own jobs
CREATE POLICY "jobs_delete_own"
  ON jobs FOR DELETE
  TO authenticated
  USING (auth.uid() = posted_by);

-- ─── Applications RLS ────────────────────────────────────────
-- Students can apply (insert their own applications)
CREATE POLICY "applications_insert_own"
  ON applications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = applicant_id);

-- Students can view their own applications; job posters can view applications to their jobs
CREATE POLICY "applications_select"
  ON applications FOR SELECT
  TO authenticated
  USING (
    auth.uid() = applicant_id
    OR auth.uid() = (SELECT posted_by FROM jobs WHERE id = job_id)
  );

-- Job posters can update status on applications to their jobs
CREATE POLICY "applications_update_status"
  ON applications FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = (SELECT posted_by FROM jobs WHERE id = job_id)
  );

-- ─── Conversations RLS ───────────────────────────────────────
-- Users can only see conversations they are part of
CREATE POLICY "conversations_select_participant"
  ON conversations FOR SELECT
  TO authenticated
  USING (
    auth.uid() = participant_one
    OR auth.uid() = participant_two
  );

-- Users can start conversations (as either participant)
CREATE POLICY "conversations_insert"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = participant_one
    OR auth.uid() = participant_two
  );

-- ─── Messages RLS ────────────────────────────────────────────
-- Users can read messages only in their own conversations
CREATE POLICY "messages_select_participant"
  ON messages FOR SELECT
  TO authenticated
  USING (
    conversation_id IN (
      SELECT id FROM conversations
      WHERE participant_one = auth.uid()
         OR participant_two = auth.uid()
    )
  );

-- Users can only send messages in their own conversations
CREATE POLICY "messages_insert_participant"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND conversation_id IN (
      SELECT id FROM conversations
      WHERE participant_one = auth.uid()
         OR participant_two = auth.uid()
    )
  );

-- Users can mark messages as read in their own conversations
CREATE POLICY "messages_update_read"
  ON messages FOR UPDATE
  TO authenticated
  USING (
    conversation_id IN (
      SELECT id FROM conversations
      WHERE participant_one = auth.uid()
         OR participant_two = auth.uid()
    )
  );

-- ─── Enable Realtime ─────────────────────────────────────────
-- In Supabase Dashboard → Database → Replication, enable these tables:
-- messages, conversations
-- Or run:
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
