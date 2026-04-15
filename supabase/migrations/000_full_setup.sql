-- ============================================================
-- CRMS Connect — Full Database Setup (Migrations 001–022)
-- Paste this entire script into Supabase SQL Editor and run.
-- Safe to run on a fresh database. All statements are guarded
-- with IF NOT EXISTS / DROP IF EXISTS / EXCEPTION handlers.
-- ============================================================


-- ════════════════════════════════════════════════════════════════
-- EXTENSIONS
-- ════════════════════════════════════════════════════════════════
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ════════════════════════════════════════════════════════════════
-- ENUMS
-- ════════════════════════════════════════════════════════════════
DO $$ BEGIN CREATE TYPE role_type            AS ENUM ('student', 'alumni', 'parent');                               EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE job_type_enum        AS ENUM ('internship', 'part-time', 'full-time', 'volunteer');         EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE application_status   AS ENUM ('pending', 'reviewed', 'accepted', 'rejected');               EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE event_type           AS ENUM ('career_fair', 'networking', 'workshop', 'info_session', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE location_type_enum   AS ENUM ('remote', 'in-person', 'hybrid');                             EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE booking_status       AS ENUM ('confirmed', 'cancelled_by_student', 'cancelled_by_mentor');  EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ════════════════════════════════════════════════════════════════
-- 001 — CORE TABLES
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS profiles (
  id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name           TEXT NOT NULL,
  role                role_type NOT NULL,
  graduation_year     INTEGER,
  bio                 TEXT,
  avatar_url          TEXT,
  onboarding_complete BOOLEAN DEFAULT FALSE NOT NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS jobs (
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
  deadline      DATE,
  is_active     BOOLEAN DEFAULT TRUE NOT NULL
);

CREATE TABLE IF NOT EXISTS applications (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  job_id       UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  applicant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  cover_note   TEXT NOT NULL,
  resume_link  TEXT,
  status       application_status DEFAULT 'pending' NOT NULL,
  UNIQUE(job_id, applicant_id)
);

CREATE TABLE IF NOT EXISTS conversations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  participant_one UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  participant_two UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  UNIQUE(participant_one, participant_two)
);

CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content         TEXT NOT NULL,
  is_read         BOOLEAN DEFAULT FALSE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id  ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at       ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_posted_by            ON jobs(posted_by);
CREATE INDEX IF NOT EXISTS idx_jobs_is_active            ON jobs(is_active, deadline);
CREATE INDEX IF NOT EXISTS idx_applications_job_id       ON applications(job_id);
CREATE INDEX IF NOT EXISTS idx_applications_applicant_id ON applications(applicant_id);

-- Auto-close expired jobs
CREATE OR REPLACE FUNCTION close_expired_jobs()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE jobs SET is_active = FALSE WHERE deadline < CURRENT_DATE AND is_active = TRUE;
END;
$$;

-- Signup trigger: validate email/role match
CREATE OR REPLACE FUNCTION public.validate_profile_email_role()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE user_email TEXT;
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
$$;

DROP TRIGGER IF EXISTS validate_profile_before_insert ON profiles;
CREATE TRIGGER validate_profile_before_insert
  BEFORE INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION validate_profile_email_role();

-- Signup trigger: auto-create profile row
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', (NEW.raw_user_meta_data->>'role')::public.role_type);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RAISE;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- RLS
ALTER TABLE profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications  ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages      ENABLE ROW LEVEL SECURITY;

-- Profiles
DROP POLICY IF EXISTS "profiles_select_authenticated" ON profiles;
CREATE POLICY "profiles_select_authenticated" ON profiles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_insert_trigger" ON profiles;
CREATE POLICY "profiles_insert_trigger" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Jobs
DROP POLICY IF EXISTS "jobs_select_authenticated" ON jobs;
CREATE POLICY "jobs_select_authenticated" ON jobs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "jobs_insert_alumni_parent" ON jobs;
CREATE POLICY "jobs_insert_alumni_parent" ON jobs FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = posted_by AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('alumni', 'parent')
);
DROP POLICY IF EXISTS "jobs_update_own" ON jobs;
CREATE POLICY "jobs_update_own" ON jobs FOR UPDATE TO authenticated USING (auth.uid() = posted_by) WITH CHECK (auth.uid() = posted_by);
DROP POLICY IF EXISTS "jobs_delete_own" ON jobs;
CREATE POLICY "jobs_delete_own" ON jobs FOR DELETE TO authenticated USING (auth.uid() = posted_by);

-- Applications
DROP POLICY IF EXISTS "applications_insert_own" ON applications;
CREATE POLICY "applications_insert_own" ON applications FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = applicant_id AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'student'
);
DROP POLICY IF EXISTS "applications_select" ON applications;
CREATE POLICY "applications_select" ON applications FOR SELECT TO authenticated USING (
  auth.uid() = applicant_id OR auth.uid() = (SELECT posted_by FROM jobs WHERE id = job_id)
);
DROP POLICY IF EXISTS "applications_update_status" ON applications;
CREATE POLICY "applications_update_status" ON applications FOR UPDATE TO authenticated USING (
  auth.uid() = (SELECT posted_by FROM jobs WHERE id = job_id)
);

-- Conversations
DROP POLICY IF EXISTS "conversations_select_participant" ON conversations;
CREATE POLICY "conversations_select_participant" ON conversations FOR SELECT TO authenticated USING (
  auth.uid() = participant_one OR auth.uid() = participant_two
);
DROP POLICY IF EXISTS "conversations_insert" ON conversations;
CREATE POLICY "conversations_insert" ON conversations FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = participant_one OR auth.uid() = participant_two
);

-- Messages
DROP POLICY IF EXISTS "messages_select_participant" ON messages;
CREATE POLICY "messages_select_participant" ON messages FOR SELECT TO authenticated USING (
  conversation_id IN (SELECT id FROM conversations WHERE participant_one = auth.uid() OR participant_two = auth.uid())
);
DROP POLICY IF EXISTS "messages_insert_participant" ON messages;
CREATE POLICY "messages_insert_participant" ON messages FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = sender_id AND conversation_id IN (SELECT id FROM conversations WHERE participant_one = auth.uid() OR participant_two = auth.uid())
);
DROP POLICY IF EXISTS "messages_update_read" ON messages;
CREATE POLICY "messages_update_read" ON messages FOR UPDATE TO authenticated USING (
  conversation_id IN (SELECT id FROM conversations WHERE participant_one = auth.uid() OR participant_two = auth.uid())
);

-- Realtime
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE messages;      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE conversations; EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ════════════════════════════════════════════════════════════════
-- 002 — ONBOARDING FLAG (already in table above, safe to re-run)
-- ════════════════════════════════════════════════════════════════
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE;


-- ════════════════════════════════════════════════════════════════
-- 003 — BUG FIXES
-- ════════════════════════════════════════════════════════════════
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_participant_one_participant_two_key;

CREATE UNIQUE INDEX IF NOT EXISTS conversations_participants_uniq ON conversations (
  LEAST(participant_one, participant_two),
  GREATEST(participant_one, participant_two)
);


-- ════════════════════════════════════════════════════════════════
-- 004 — EVENTS + APPLICATION DELETE + ROLLING DEADLINES
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS events (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  location    TEXT,
  date        DATE NOT NULL,
  time        TEXT,
  type        event_type DEFAULT 'other' NOT NULL,
  host_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  host_name   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
CREATE INDEX IF NOT EXISTS idx_events_host ON events(host_id);
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "events_select_authenticated"  ON events;
CREATE POLICY "events_select_authenticated"  ON events FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "events_insert_alumni_parent"  ON events;
CREATE POLICY "events_insert_alumni_parent"  ON events FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = host_id AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('alumni', 'parent')
);
DROP POLICY IF EXISTS "events_update_own" ON events;
CREATE POLICY "events_update_own" ON events FOR UPDATE TO authenticated USING (auth.uid() = host_id) WITH CHECK (auth.uid() = host_id);
DROP POLICY IF EXISTS "events_delete_own" ON events;
CREATE POLICY "events_delete_own" ON events FOR DELETE TO authenticated USING (auth.uid() = host_id);

DROP POLICY IF EXISTS "applications_delete_own" ON applications;
CREATE POLICY "applications_delete_own" ON applications FOR DELETE TO authenticated USING (
  auth.uid() = applicant_id AND status = 'pending'
);

ALTER TABLE jobs ALTER COLUMN deadline DROP NOT NULL;


-- ════════════════════════════════════════════════════════════════
-- 005 — COMPANY ON PROFILES
-- ════════════════════════════════════════════════════════════════
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company TEXT;


-- ════════════════════════════════════════════════════════════════
-- 006 — PINNED JOBS
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS pinned_jobs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_id     UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, job_id)
);
ALTER TABLE pinned_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own pins" ON pinned_jobs;
CREATE POLICY "Users can view own pins" ON pinned_jobs FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can pin jobs" ON pinned_jobs;
CREATE POLICY "Users can pin jobs"      ON pinned_jobs FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can unpin jobs" ON pinned_jobs;
CREATE POLICY "Users can unpin jobs"    ON pinned_jobs FOR DELETE USING (auth.uid() = user_id);


-- ════════════════════════════════════════════════════════════════
-- 007 — FOLLOWS
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS follows (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (follower_id, following_id),
  CHECK (follower_id != following_id)
);
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view follows" ON follows;
CREATE POLICY "Authenticated users can view follows" ON follows FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Users can follow others" ON follows;
CREATE POLICY "Users can follow others" ON follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
DROP POLICY IF EXISTS "Users can unfollow" ON follows;
CREATE POLICY "Users can unfollow"      ON follows FOR DELETE USING (auth.uid() = follower_id);


-- ════════════════════════════════════════════════════════════════
-- 008 — JOB CAPACITY + APPLICANT COUNT
-- ════════════════════════════════════════════════════════════════
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS capacity        INTEGER NOT NULL DEFAULT 1;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS required_skills TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS applicant_count INTEGER NOT NULL DEFAULT 0;

UPDATE jobs j SET applicant_count = (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id);

CREATE OR REPLACE FUNCTION update_job_applicant_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE jobs SET applicant_count = applicant_count + 1 WHERE id = NEW.job_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE jobs SET applicant_count = GREATEST(0, applicant_count - 1) WHERE id = OLD.job_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_job_applicant_count ON applications;
CREATE TRIGGER trigger_update_job_applicant_count
  AFTER INSERT OR DELETE ON applications
  FOR EACH ROW EXECUTE FUNCTION update_job_applicant_count();


-- ════════════════════════════════════════════════════════════════
-- 009 — PINNED APPLICATIONS
-- ════════════════════════════════════════════════════════════════
ALTER TABLE applications ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT FALSE;


-- ════════════════════════════════════════════════════════════════
-- 010 + 011 — SOFT-DELETE ACCOUNT
-- ════════════════════════════════════════════════════════════════
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION delete_own_account()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE profiles SET deleted_at = now() WHERE id = auth.uid();
END;
$$;
REVOKE ALL ON FUNCTION delete_own_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_own_account() TO authenticated;

CREATE OR REPLACE FUNCTION recover_own_account()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE profiles SET deleted_at = NULL
  WHERE id = auth.uid() AND deleted_at IS NOT NULL AND deleted_at > now() - INTERVAL '30 days';
END;
$$;
REVOKE ALL ON FUNCTION recover_own_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION recover_own_account() TO authenticated;


-- ════════════════════════════════════════════════════════════════
-- 012 — PUSH SUBSCRIPTIONS
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL,
  p256dh     TEXT NOT NULL,
  auth_key   TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "push_subscriptions_select_own" ON push_subscriptions;
CREATE POLICY "push_subscriptions_select_own" ON push_subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "push_subscriptions_insert_own" ON push_subscriptions;
CREATE POLICY "push_subscriptions_insert_own" ON push_subscriptions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "push_subscriptions_delete_own" ON push_subscriptions;
CREATE POLICY "push_subscriptions_delete_own" ON push_subscriptions FOR DELETE TO authenticated USING (auth.uid() = user_id);


-- ════════════════════════════════════════════════════════════════
-- 013 — ALUMNI ENHANCEMENTS (career history + old booking tables)
-- Note: availability_slots and bookings are recreated by 016 below
-- ════════════════════════════════════════════════════════════════
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS industry           TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS open_to_mentorship BOOLEAN DEFAULT FALSE NOT NULL;

CREATE TABLE IF NOT EXISTS career_history (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company    TEXT NOT NULL,
  title      TEXT NOT NULL,
  start_year INTEGER NOT NULL,
  end_year   INTEGER,
  is_current BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_career_history_profile ON career_history(profile_id);
ALTER TABLE career_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "career_history_select_authenticated" ON career_history;
CREATE POLICY "career_history_select_authenticated" ON career_history FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "career_history_insert_own" ON career_history;
CREATE POLICY "career_history_insert_own" ON career_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = profile_id);
DROP POLICY IF EXISTS "career_history_update_own" ON career_history;
CREATE POLICY "career_history_update_own" ON career_history FOR UPDATE TO authenticated USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);
DROP POLICY IF EXISTS "career_history_delete_own" ON career_history;
CREATE POLICY "career_history_delete_own" ON career_history FOR DELETE TO authenticated USING (auth.uid() = profile_id);

-- Old availability_slots (will be dropped and replaced by 016)
CREATE TABLE IF NOT EXISTS availability_slots (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  day_of_week   INTEGER,
  specific_date DATE,
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT valid_slot CHECK (
    (day_of_week IS NOT NULL AND specific_date IS NULL)
    OR (day_of_week IS NULL AND specific_date IS NOT NULL)
  ),
  CONSTRAINT valid_time_range CHECK (start_time < end_time)
);

-- Old bookings (will be dropped by 016)
CREATE TABLE IF NOT EXISTS bookings (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slot_id      UUID NOT NULL REFERENCES availability_slots(id) ON DELETE CASCADE,
  student_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  mentor_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  booking_date DATE NOT NULL,
  start_time   TIME NOT NULL,
  end_time     TIME NOT NULL,
  status       booking_status DEFAULT 'confirmed' NOT NULL,
  note         TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(mentor_id, booking_date, start_time)
);


-- ════════════════════════════════════════════════════════════════
-- 014 — LOCATION TYPE + INDUSTRY ON JOBS
-- ════════════════════════════════════════════════════════════════
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS location_type location_type_enum NOT NULL DEFAULT 'in-person';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS industry      TEXT;


-- ════════════════════════════════════════════════════════════════
-- 015 — MARKETPLACE (table only; feature removed from UI)
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS marketplace_listings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT NOT NULL,
  price           NUMERIC(10,2),
  condition       TEXT NOT NULL CHECK (condition IN ('new', 'like_new', 'good', 'fair', 'poor')),
  category        TEXT NOT NULL DEFAULT 'Other',
  pickup_location TEXT,
  photos          TEXT[] NOT NULL DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sold')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE marketplace_listings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "marketplace_select_active" ON marketplace_listings;
CREATE POLICY "marketplace_select_active" ON marketplace_listings FOR SELECT TO authenticated USING (status = 'active');
DROP POLICY IF EXISTS "marketplace_insert_own" ON marketplace_listings;
CREATE POLICY "marketplace_insert_own" ON marketplace_listings FOR INSERT TO authenticated WITH CHECK (seller_id = auth.uid());
DROP POLICY IF EXISTS "marketplace_update_own" ON marketplace_listings;
CREATE POLICY "marketplace_update_own" ON marketplace_listings FOR UPDATE TO authenticated USING (seller_id = auth.uid()) WITH CHECK (seller_id = auth.uid());
DROP POLICY IF EXISTS "marketplace_delete_own" ON marketplace_listings;
CREATE POLICY "marketplace_delete_own" ON marketplace_listings FOR DELETE TO authenticated USING (seller_id = auth.uid());


-- ════════════════════════════════════════════════════════════════
-- 016 — PERSONAL AVAILABILITY CALENDAR
-- Drops old booking tables, creates new private availability_slots
-- ════════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS bookings          CASCADE;
DROP TABLE IF EXISTS availability_slots CASCADE;

CREATE TABLE availability_slots (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title               TEXT,
  date                DATE NOT NULL,
  start_time          TIME NOT NULL,
  end_time            TIME NOT NULL,
  is_recurring        BOOLEAN DEFAULT FALSE NOT NULL,
  recurrence_pattern  TEXT CHECK (recurrence_pattern IN ('daily', 'weekly', 'monthly')),
  recurrence_end_date DATE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_time_range CHECK (end_time > start_time)
);
CREATE INDEX IF NOT EXISTS idx_avail_slots_user_id ON availability_slots(user_id);
CREATE INDEX IF NOT EXISTS idx_avail_slots_date    ON availability_slots(date);
ALTER TABLE availability_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "slots_select_own" ON availability_slots FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "slots_insert_own" ON availability_slots FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "slots_update_own" ON availability_slots FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "slots_delete_own" ON availability_slots FOR DELETE USING (auth.uid() = user_id);


-- ════════════════════════════════════════════════════════════════
-- 017 — CONNECTION REQUEST OVERHAUL
-- ════════════════════════════════════════════════════════════════
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS interests           text[] NOT NULL DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS weekly_availability text;
ALTER TABLE jobs     ADD COLUMN IF NOT EXISTS expected_weekly_hours text;
ALTER TYPE application_status ADD VALUE IF NOT EXISTS 'waitlisted';


-- ════════════════════════════════════════════════════════════════
-- 018 — ACCOUNT TYPE MERGE: alumni + parent → employer_mentor
-- ════════════════════════════════════════════════════════════════

-- Add new enum value (old values stay in enum but are no longer used by new signups)
ALTER TYPE role_type ADD VALUE IF NOT EXISTS 'employer_mentor';

-- Migrate all existing alumni/parent profiles to employer_mentor
UPDATE profiles SET role = 'employer_mentor' WHERE role IN ('alumni', 'parent');

-- Update the email/role validation trigger to accept the new role
CREATE OR REPLACE FUNCTION public.validate_profile_email_role()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE user_email TEXT;
BEGIN
  SELECT email INTO user_email FROM auth.users WHERE id = NEW.id;
  IF NEW.role = 'student' AND lower(user_email) NOT LIKE '%@crms.org' THEN
    RAISE EXCEPTION 'Student accounts require a @crms.org school email address.';
  END IF;
  IF NEW.role = 'employer_mentor' AND lower(user_email) LIKE '%@crms.org' THEN
    RAISE EXCEPTION 'Please use a personal email address, not your school email.';
  END IF;
  -- Reject deprecated roles
  IF NEW.role IN ('alumni', 'parent') THEN
    RAISE EXCEPTION 'These account types are no longer available. Please sign up as Employer/Mentor.';
  END IF;
  RETURN NEW;
END;
$$;


-- ════════════════════════════════════════════════════════════════
-- 019 — MENTOR TYPE + STUDENT SEEKING + GRADE
-- ════════════════════════════════════════════════════════════════

-- employer_mentor sub-role
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS mentor_type       TEXT CHECK (mentor_type IN ('employer', 'mentor', 'both', 'other'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS mentor_type_other TEXT;

-- student seeking
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS student_seeking       TEXT CHECK (student_seeking IN ('job', 'mentor', 'both', 'other'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS student_seeking_other TEXT;

-- student grade level
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS grade TEXT CHECK (grade IN ('9th', '10th', '11th', '12th', 'Gap Year'));

-- interests "Other" custom text
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS interests_other TEXT;


-- ════════════════════════════════════════════════════════════════
-- 020 — OPPORTUNITY TYPE + TIMEFRAME ON JOBS
-- ════════════════════════════════════════════════════════════════
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS opportunity_type       TEXT CHECK (opportunity_type IN ('job_internship', 'mentorship', 'volunteer', 'shadow', 'other'));
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS opportunity_type_other TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS start_date             DATE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS end_date               DATE;


-- ════════════════════════════════════════════════════════════════
-- 021 — STUDENT POSTS
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS student_posts (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pitch         TEXT        NOT NULL,
  seeking       TEXT        NOT NULL CHECK (seeking IN ('job', 'mentor', 'both', 'other')),
  seeking_other TEXT,
  interests     TEXT[]      NOT NULL DEFAULT '{}',
  availability  TEXT,
  is_closed     BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_student_posts_student_id ON student_posts(student_id);
CREATE INDEX IF NOT EXISTS idx_student_posts_is_closed  ON student_posts(is_closed);
ALTER TABLE student_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "student_posts_insert_own"   ON student_posts;
CREATE POLICY "student_posts_insert_own" ON student_posts FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = student_id
  AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'student'
);

DROP POLICY IF EXISTS "student_posts_update_own"   ON student_posts;
CREATE POLICY "student_posts_update_own" ON student_posts FOR UPDATE TO authenticated
  USING (auth.uid() = student_id) WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "student_posts_delete_own"   ON student_posts;
CREATE POLICY "student_posts_delete_own" ON student_posts FOR DELETE TO authenticated
  USING (auth.uid() = student_id);

-- employer_mentor can SELECT open posts; students can only see their own
DROP POLICY IF EXISTS "student_posts_select"        ON student_posts;
CREATE POLICY "student_posts_select" ON student_posts FOR SELECT TO authenticated USING (
  auth.uid() = student_id
  OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'employer_mentor'
);


-- ════════════════════════════════════════════════════════════════
-- 022 — OPPORTUNITY VISIBILITY: employer_mentor sees own only
-- ════════════════════════════════════════════════════════════════

-- Replace the open SELECT policy with a scoped one
DROP POLICY IF EXISTS "jobs_select_authenticated"  ON jobs;
CREATE POLICY "jobs_select_authenticated" ON jobs FOR SELECT TO authenticated USING (
  auth.uid() = posted_by
  OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'student'
);

-- Replace INSERT policy (now employer_mentor instead of alumni/parent)
DROP POLICY IF EXISTS "jobs_insert_alumni_parent"  ON jobs;
DROP POLICY IF EXISTS "jobs_insert_employer_mentor" ON jobs;
CREATE POLICY "jobs_insert_employer_mentor" ON jobs FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = posted_by
  AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'employer_mentor'
);

-- Events: update INSERT policy to employer_mentor
DROP POLICY IF EXISTS "events_insert_alumni_parent"   ON events;
DROP POLICY IF EXISTS "events_insert_employer_mentor" ON events;
CREATE POLICY "events_insert_employer_mentor" ON events FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = host_id
  AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'employer_mentor'
);


-- ════════════════════════════════════════════════════════════════
-- 023 — MEETING REQUESTS + PUBLIC AVAILABILITY SLOTS
-- ════════════════════════════════════════════════════════════════

-- Allow any authenticated user to read any user's availability slots
-- (app layer filters by date; needed for PublicProfile slot display)
DROP POLICY IF EXISTS "slots_select_others" ON availability_slots;
CREATE POLICY "slots_select_others"
  ON availability_slots FOR SELECT
  TO authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS meeting_requests (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at            TIMESTAMPTZ DEFAULT now() NOT NULL,
  requester_id          UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  recipient_id          UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  slot_id               UUID        REFERENCES availability_slots(id) ON DELETE SET NULL,
  requested_date        DATE        NOT NULL,
  requested_start_time  TIME        NOT NULL,
  requested_end_time    TIME        NOT NULL,
  note                  TEXT,
  status                TEXT        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'accepted', 'declined')),
  CONSTRAINT no_self_request CHECK (requester_id <> recipient_id)
);
CREATE INDEX IF NOT EXISTS idx_meeting_requests_requester ON meeting_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_meeting_requests_recipient ON meeting_requests(recipient_id);
CREATE INDEX IF NOT EXISTS idx_meeting_requests_slot      ON meeting_requests(slot_id);
ALTER TABLE meeting_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "meeting_requests_select" ON meeting_requests;
CREATE POLICY "meeting_requests_select" ON meeting_requests FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR recipient_id = auth.uid());

DROP POLICY IF EXISTS "meeting_requests_insert" ON meeting_requests;
CREATE POLICY "meeting_requests_insert" ON meeting_requests FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid());

DROP POLICY IF EXISTS "meeting_requests_update" ON meeting_requests;
CREATE POLICY "meeting_requests_update" ON meeting_requests FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid()) WITH CHECK (recipient_id = auth.uid());

DROP POLICY IF EXISTS "meeting_requests_delete" ON meeting_requests;
CREATE POLICY "meeting_requests_delete" ON meeting_requests FOR DELETE TO authenticated
  USING (requester_id = auth.uid());


-- ════════════════════════════════════════════════════════════════
-- 024 — ADMIN ROLE, BANNED ACCOUNTS, ADMIN PANEL FUNCTIONS
-- ════════════════════════════════════════════════════════════════

-- Add admin enum value
ALTER TYPE role_type ADD VALUE IF NOT EXISTS 'admin';

-- banned_at column on profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ DEFAULT NULL;

-- is_admin() helper — used by RLS policies and action functions
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;

-- Update email validation trigger to skip admin and block deprecated roles on new signups
CREATE OR REPLACE FUNCTION public.validate_profile_email_role()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE user_email TEXT;
BEGIN
  IF NEW.role = 'admin' THEN RETURN NEW; END IF;
  SELECT email INTO user_email FROM auth.users WHERE id = NEW.id;
  IF NEW.role = 'student' AND lower(user_email) NOT LIKE '%@crms.org' THEN
    RAISE EXCEPTION 'Student accounts require a @crms.org school email address.';
  END IF;
  IF NEW.role IN ('alumni', 'parent', 'employer_mentor') AND lower(user_email) LIKE '%@crms.org' THEN
    RAISE EXCEPTION 'Please use a personal email address, not your school email.';
  END IF;
  IF NEW.role IN ('alumni', 'parent') THEN
    RAISE EXCEPTION 'These account types are no longer available. Please sign up as Employer/Mentor.';
  END IF;
  RETURN NEW;
END;
$$;

-- profiles UPDATE: admin can update any profile (used for banning)
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own_or_admin" ON profiles FOR UPDATE TO authenticated
  USING  (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());

-- jobs SELECT: admin sees all
DROP POLICY IF EXISTS "jobs_select_authenticated" ON jobs;
CREATE POLICY "jobs_select_authenticated" ON jobs FOR SELECT TO authenticated USING (
  public.is_admin()
  OR auth.uid() = posted_by
  OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'student'
);

-- jobs DELETE: admin can delete any job
DROP POLICY IF EXISTS "jobs_delete_own" ON jobs;
CREATE POLICY "jobs_delete_own_or_admin" ON jobs FOR DELETE TO authenticated
  USING (auth.uid() = posted_by OR public.is_admin());

-- applications SELECT: admin sees all
DROP POLICY IF EXISTS "applications_select" ON applications;
CREATE POLICY "applications_select" ON applications FOR SELECT TO authenticated USING (
  public.is_admin()
  OR auth.uid() = applicant_id
  OR auth.uid() = (SELECT posted_by FROM public.jobs WHERE id = job_id)
);

-- student_posts SELECT: admin sees all including closed
DROP POLICY IF EXISTS "student_posts_read_open" ON student_posts;
DROP POLICY IF EXISTS "student_posts_select" ON student_posts;
CREATE POLICY "student_posts_read_open_or_admin" ON student_posts FOR SELECT USING (
  public.is_admin() OR is_closed = false OR student_id = auth.uid()
);

-- Admin action functions
CREATE OR REPLACE FUNCTION public.admin_ban_user(target_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Forbidden: admin only'; END IF;
  IF target_id = auth.uid() THEN RAISE EXCEPTION 'Admin cannot ban themselves'; END IF;
  UPDATE public.profiles SET banned_at = now() WHERE id = target_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_unban_user(target_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Forbidden: admin only'; END IF;
  UPDATE public.profiles SET banned_at = NULL WHERE id = target_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  id UUID, full_name TEXT, role TEXT, created_at TIMESTAMPTZ,
  banned_at TIMESTAMPTZ, onboarding_complete BOOLEAN, email TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Forbidden: admin only'; END IF;
  RETURN QUERY
    SELECT p.id, p.full_name, p.role::TEXT, p.created_at,
           p.banned_at, p.onboarding_complete, u.email
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    ORDER BY p.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_user_email(target_id UUID)
RETURNS TEXT LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Forbidden: admin only'; END IF;
  RETURN (SELECT email FROM auth.users WHERE id = target_id);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- HOW TO BECOME ADMIN
-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Sign up normally through the app (any email, any role)
-- 2. Run this in Supabase Dashboard → SQL Editor (replace with your email):
--
--   UPDATE public.profiles
--   SET role = 'admin'
--   WHERE id = (SELECT id FROM auth.users WHERE email = 'your@email.com');
--
-- The email validation trigger only fires on INSERT, not UPDATE, so this
-- is safe regardless of your email domain.
-- ─────────────────────────────────────────────────────────────────────────────


-- ════════════════════════════════════════════════════════════════
-- RELOAD SCHEMA CACHE
-- ════════════════════════════════════════════════════════════════
NOTIFY pgrst, 'reload schema';
