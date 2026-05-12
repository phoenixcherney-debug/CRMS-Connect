-- ============================================================
-- CRMS Connect — Full Database Setup (Migrations 001–056)
-- Safe to paste into Supabase SQL Editor on a fresh database.
-- Also idempotent: safe to re-run on an existing database.
--
-- This file is composed of two halves:
--   • Lines 1..(NOTIFY pgrst):  the original 001–022 baseline.
--   • The "Round 2 — 023..056" appendix below: net additions from
--     migrations 023 through 056. Reversed migrations (042 email
--     verification, 033 employer/mentor approval gate) are NOT
--     included — their reversal in 049 / 050 is the current state.
-- ============================================================


-- ════════════════════════════════════════════════════════════════
-- EXTENSIONS
-- ════════════════════════════════════════════════════════════════
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ════════════════════════════════════════════════════════════════
-- ENUMS
-- ════════════════════════════════════════════════════════════════
DO $$ BEGIN CREATE TYPE role_type          AS ENUM ('student', 'alumni', 'parent'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TYPE role_type ADD VALUE IF NOT EXISTS 'employer_mentor';
ALTER TYPE role_type ADD VALUE IF NOT EXISTS 'admin';

DO $$ BEGIN CREATE TYPE job_type_enum      AS ENUM ('internship', 'part-time', 'full-time', 'volunteer'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE application_status AS ENUM ('pending', 'reviewed', 'accepted', 'rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TYPE application_status ADD VALUE IF NOT EXISTS 'waitlisted';

DO $$ BEGIN CREATE TYPE event_type         AS ENUM ('career_fair', 'networking', 'workshop', 'info_session', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE location_type_enum AS ENUM ('remote', 'in-person', 'hybrid'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE booking_status     AS ENUM ('confirmed', 'cancelled_by_student', 'cancelled_by_mentor'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ════════════════════════════════════════════════════════════════
-- TABLES
-- ════════════════════════════════════════════════════════════════

-- ── profiles ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id                    UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name             TEXT        NOT NULL,
  role                  role_type   NOT NULL,
  graduation_year       INTEGER,
  bio                   TEXT,
  avatar_url            TEXT,
  onboarding_complete   BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  company               TEXT,
  industry              TEXT,
  open_to_mentorship    BOOLEAN     NOT NULL DEFAULT FALSE,
  interests             TEXT[]      NOT NULL DEFAULT '{}',
  weekly_availability   TEXT,
  notifications_seen_at TIMESTAMPTZ,
  mentor_type           TEXT,
  mentor_type_other     TEXT,
  student_seeking       TEXT,
  student_seeking_other TEXT,
  grade                 TEXT,
  interests_other       TEXT,
  banned_at             TIMESTAMPTZ DEFAULT NULL
);
-- Idempotent column additions for existing databases
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company               TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS industry              TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS open_to_mentorship    BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS interests             TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS weekly_availability   TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notifications_seen_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS mentor_type           TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS mentor_type_other     TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS student_seeking       TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS student_seeking_other TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS grade                 TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS interests_other       TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS banned_at             TIMESTAMPTZ DEFAULT NULL;
-- Remove legacy column if it still exists (dropped in migration 020)
ALTER TABLE profiles DROP COLUMN IF EXISTS deleted_at;

-- ── jobs ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jobs (
  id                     UUID               PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at             TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  posted_by              UUID               NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title                  TEXT               NOT NULL,
  company                TEXT               NOT NULL,
  location               TEXT               NOT NULL,
  job_type               job_type_enum      NOT NULL,
  description            TEXT               NOT NULL,
  how_to_apply           TEXT               NOT NULL,
  contact_email          TEXT               NOT NULL,
  deadline               DATE,
  is_active              BOOLEAN            NOT NULL DEFAULT TRUE,
  location_type          location_type_enum NOT NULL DEFAULT 'in-person',
  industry               TEXT,
  expected_weekly_hours  TEXT,
  opportunity_type       TEXT,
  opportunity_type_other TEXT,
  start_date             DATE,
  end_date               DATE
);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS location_type          location_type_enum NOT NULL DEFAULT 'in-person';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS industry               TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS expected_weekly_hours  TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS opportunity_type       TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS opportunity_type_other TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS start_date             DATE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS end_date               DATE;
-- Remove legacy columns (dropped in migration 020)
ALTER TABLE jobs DROP COLUMN IF EXISTS capacity;
ALTER TABLE jobs DROP COLUMN IF EXISTS required_skills;
ALTER TABLE jobs DROP COLUMN IF EXISTS applicant_count;
ALTER TABLE jobs DROP COLUMN IF EXISTS is_pinned;

-- ── applications ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS applications (
  id           UUID               PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at   TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  job_id       UUID               NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  applicant_id UUID               NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  cover_note   TEXT               NOT NULL,
  resume_link  TEXT,
  status       application_status NOT NULL DEFAULT 'pending',
  is_pinned    BOOLEAN            NOT NULL DEFAULT FALSE,
  UNIQUE(job_id, applicant_id)
);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT FALSE;

-- ── conversations ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  participant_one UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  participant_two UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE
);
-- Drop old unique constraint and replace with order-independent index
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_participant_one_participant_two_key;
CREATE UNIQUE INDEX IF NOT EXISTS conversations_participants_uniq ON conversations (
  LEAST(participant_one, participant_two),
  GREATEST(participant_one, participant_two)
);

-- ── messages ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  conversation_id UUID        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content         TEXT        NOT NULL,
  is_read         BOOLEAN     NOT NULL DEFAULT FALSE
);

-- ── events ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  title       TEXT        NOT NULL,
  description TEXT,
  location    TEXT,
  date        DATE        NOT NULL,
  time        TEXT,
  type        event_type  NOT NULL DEFAULT 'other',
  host_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  host_name   TEXT        NOT NULL
);

-- ── push_subscriptions ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint   TEXT        NOT NULL,
  p256dh     TEXT        NOT NULL,
  auth_key   TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, endpoint)
);

-- ── career_history ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS career_history (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company    TEXT        NOT NULL,
  title      TEXT        NOT NULL,
  start_year INTEGER     NOT NULL,
  end_year   INTEGER,
  is_current BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── availability_slots (final schema — migration 016 replaced the original) ──
-- DROP + recreate handles both fresh installs and existing DBs with old schema.
DROP TABLE IF EXISTS bookings           CASCADE;
DROP TABLE IF EXISTS availability_slots CASCADE;

CREATE TABLE availability_slots (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title               TEXT,
  date                DATE        NOT NULL,
  start_time          TIME        NOT NULL,
  end_time            TIME        NOT NULL,
  is_recurring        BOOLEAN     NOT NULL DEFAULT FALSE,
  recurrence_pattern  TEXT        CHECK (recurrence_pattern IN ('daily', 'weekly', 'monthly')),
  recurrence_end_date DATE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- ── marketplace_listings ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS marketplace_listings (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id       UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title           TEXT        NOT NULL,
  description     TEXT        NOT NULL,
  price           NUMERIC(10,2),
  condition       TEXT        NOT NULL CHECK (condition IN ('new', 'like_new', 'good', 'fair', 'poor')),
  category        TEXT        NOT NULL DEFAULT 'Other',
  pickup_location TEXT,
  photos          TEXT[]      NOT NULL DEFAULT '{}',
  status          TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sold')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── student_posts ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS student_posts (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pitch         TEXT        NOT NULL,
  seeking       TEXT        NOT NULL,
  seeking_other TEXT,
  interests     TEXT[]      NOT NULL DEFAULT '{}',
  availability  TEXT,
  is_closed     BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Ensure FK references profiles (not auth.users as in an earlier version)
ALTER TABLE student_posts DROP CONSTRAINT IF EXISTS student_posts_student_id_fkey;
ALTER TABLE student_posts ADD CONSTRAINT student_posts_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- ── meeting_requests ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meeting_requests (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  requester_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slot_id              UUID        REFERENCES availability_slots(id) ON DELETE SET NULL,
  requested_date       DATE        NOT NULL,
  requested_start_time TIME        NOT NULL,
  requested_end_time   TIME        NOT NULL,
  note                 TEXT,
  status               TEXT        NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'accepted', 'declined')),
  CONSTRAINT no_self_request CHECK (requester_id <> recipient_id)
);


-- ════════════════════════════════════════════════════════════════
-- INDEXES
-- ════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id   ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at        ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_posted_by             ON jobs(posted_by);
CREATE INDEX IF NOT EXISTS idx_jobs_is_active             ON jobs(is_active, deadline);
CREATE INDEX IF NOT EXISTS idx_applications_job_id        ON applications(job_id);
CREATE INDEX IF NOT EXISTS idx_applications_applicant_id  ON applications(applicant_id);
CREATE INDEX IF NOT EXISTS idx_events_date                ON events(date);
CREATE INDEX IF NOT EXISTS idx_events_host                ON events(host_id);
CREATE INDEX IF NOT EXISTS idx_career_history_profile     ON career_history(profile_id);
CREATE INDEX IF NOT EXISTS idx_avail_slots_user_id        ON availability_slots(user_id);
CREATE INDEX IF NOT EXISTS idx_avail_slots_date           ON availability_slots(date);
CREATE INDEX IF NOT EXISTS idx_marketplace_seller_id      ON marketplace_listings(seller_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_status_date    ON marketplace_listings(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_category       ON marketplace_listings(category);
CREATE INDEX IF NOT EXISTS idx_student_posts_student_id   ON student_posts(student_id);
CREATE INDEX IF NOT EXISTS idx_student_posts_seeking      ON student_posts(seeking);
CREATE INDEX IF NOT EXISTS idx_student_posts_is_closed    ON student_posts(is_closed);
CREATE INDEX IF NOT EXISTS idx_meeting_requests_requester ON meeting_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_meeting_requests_recipient ON meeting_requests(recipient_id);
CREATE INDEX IF NOT EXISTS idx_meeting_requests_slot      ON meeting_requests(slot_id);


-- ════════════════════════════════════════════════════════════════
-- FUNCTIONS
-- ════════════════════════════════════════════════════════════════

-- Auto-close jobs past their deadline
-- To schedule: SELECT cron.schedule('close-expired-jobs', '0 0 * * *', 'SELECT close_expired_jobs()');
CREATE OR REPLACE FUNCTION close_expired_jobs()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE jobs SET is_active = FALSE WHERE deadline < CURRENT_DATE AND is_active = TRUE;
END;
$$;

-- Auto-create profile row on new signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    (NEW.raw_user_meta_data->>'role')::public.role_type
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RAISE;
END;
$$;

-- Validate email domain matches role on profile insert
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

-- Keep marketplace updated_at current
CREATE OR REPLACE FUNCTION set_marketplace_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Admin helper: returns true if the calling user has the admin role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
END;
$$;

-- Admin: list all users with email addresses (not available via profiles table alone)
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

-- Admin: get a single user's email address
CREATE OR REPLACE FUNCTION public.admin_get_user_email(target_id UUID)
RETURNS TEXT LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Forbidden: admin only'; END IF;
  RETURN (SELECT email FROM auth.users WHERE id = target_id);
END;
$$;

-- Admin: ban a user (sets banned_at timestamp)
CREATE OR REPLACE FUNCTION public.admin_ban_user(target_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Forbidden: admin only'; END IF;
  IF target_id = auth.uid() THEN RAISE EXCEPTION 'Admin cannot ban themselves'; END IF;
  UPDATE public.profiles SET banned_at = now() WHERE id = target_id;
END;
$$;

-- Admin: unban a user (clears banned_at)
CREATE OR REPLACE FUNCTION public.admin_unban_user(target_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Forbidden: admin only'; END IF;
  UPDATE public.profiles SET banned_at = NULL WHERE id = target_id;
END;
$$;


-- ════════════════════════════════════════════════════════════════
-- TRIGGERS
-- ════════════════════════════════════════════════════════════════
DROP TRIGGER IF EXISTS validate_profile_before_insert ON profiles;
CREATE TRIGGER validate_profile_before_insert
  BEFORE INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION validate_profile_email_role();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

DROP TRIGGER IF EXISTS marketplace_listings_updated_at ON marketplace_listings;
CREATE TRIGGER marketplace_listings_updated_at
  BEFORE UPDATE ON marketplace_listings
  FOR EACH ROW EXECUTE FUNCTION set_marketplace_updated_at();


-- ════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ════════════════════════════════════════════════════════════════
ALTER TABLE profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications         ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages             ENABLE ROW LEVEL SECURITY;
ALTER TABLE events               ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_history       ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_slots   ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_posts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_requests     ENABLE ROW LEVEL SECURITY;

-- ── profiles ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles_select_authenticated"               ON profiles;
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON profiles;
CREATE POLICY "profiles_select_authenticated"
  ON profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_update_own"          ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON profiles;
CREATE POLICY "profiles_update_own_or_admin"
  ON profiles FOR UPDATE TO authenticated
  USING  (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "profiles_insert_trigger" ON profiles;
CREATE POLICY "profiles_insert_trigger"
  ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- ── jobs ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "jobs_select_authenticated" ON jobs;
CREATE POLICY "jobs_select_authenticated"
  ON jobs FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR auth.uid() = posted_by
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'student'
  );

DROP POLICY IF EXISTS "jobs_insert_alumni_parent"   ON jobs;
DROP POLICY IF EXISTS "jobs_insert_employer_mentor" ON jobs;
CREATE POLICY "jobs_insert_employer_mentor"
  ON jobs FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = posted_by
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'employer_mentor'
  );

DROP POLICY IF EXISTS "jobs_update_own" ON jobs;
CREATE POLICY "jobs_update_own"
  ON jobs FOR UPDATE TO authenticated
  USING (auth.uid() = posted_by) WITH CHECK (auth.uid() = posted_by);

DROP POLICY IF EXISTS "jobs_delete_own"          ON jobs;
DROP POLICY IF EXISTS "jobs_delete_own_or_admin" ON jobs;
CREATE POLICY "jobs_delete_own_or_admin"
  ON jobs FOR DELETE TO authenticated
  USING (auth.uid() = posted_by OR public.is_admin());

-- ── applications ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "applications_insert_own" ON applications;
CREATE POLICY "applications_insert_own"
  ON applications FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = applicant_id
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'student'
  );

DROP POLICY IF EXISTS "applications_select" ON applications;
CREATE POLICY "applications_select"
  ON applications FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR auth.uid() = applicant_id
    OR auth.uid() = (SELECT posted_by FROM public.jobs WHERE id = job_id)
  );

DROP POLICY IF EXISTS "applications_update_status" ON applications;
CREATE POLICY "applications_update_status"
  ON applications FOR UPDATE TO authenticated
  USING (auth.uid() = (SELECT posted_by FROM public.jobs WHERE id = job_id));

DROP POLICY IF EXISTS "applications_delete_own" ON applications;
CREATE POLICY "applications_delete_own"
  ON applications FOR DELETE TO authenticated
  USING (auth.uid() = applicant_id AND status = 'pending');

-- ── conversations ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "conversations_select_participant" ON conversations;
CREATE POLICY "conversations_select_participant"
  ON conversations FOR SELECT TO authenticated
  USING (auth.uid() = participant_one OR auth.uid() = participant_two);

DROP POLICY IF EXISTS "conversations_insert" ON conversations;
CREATE POLICY "conversations_insert"
  ON conversations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = participant_one OR auth.uid() = participant_two);

-- ── messages ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "messages_select_participant" ON messages;
CREATE POLICY "messages_select_participant"
  ON messages FOR SELECT TO authenticated
  USING (
    conversation_id IN (
      SELECT id FROM conversations
      WHERE participant_one = auth.uid() OR participant_two = auth.uid()
    )
  );

DROP POLICY IF EXISTS "messages_insert_participant" ON messages;
CREATE POLICY "messages_insert_participant"
  ON messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND conversation_id IN (
      SELECT id FROM conversations
      WHERE participant_one = auth.uid() OR participant_two = auth.uid()
    )
  );

DROP POLICY IF EXISTS "messages_update_read" ON messages;
CREATE POLICY "messages_update_read"
  ON messages FOR UPDATE TO authenticated
  USING (
    conversation_id IN (
      SELECT id FROM conversations
      WHERE participant_one = auth.uid() OR participant_two = auth.uid()
    )
  );

-- ── events ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "events_select_authenticated"   ON events;
CREATE POLICY "events_select_authenticated"
  ON events FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "events_insert_alumni_parent"   ON events;
DROP POLICY IF EXISTS "events_insert_employer_mentor" ON events;
CREATE POLICY "events_insert_employer_mentor"
  ON events FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = host_id
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'employer_mentor'
  );

DROP POLICY IF EXISTS "events_update_own" ON events;
CREATE POLICY "events_update_own"
  ON events FOR UPDATE TO authenticated
  USING (auth.uid() = host_id) WITH CHECK (auth.uid() = host_id);

DROP POLICY IF EXISTS "events_delete_own" ON events;
CREATE POLICY "events_delete_own"
  ON events FOR DELETE TO authenticated USING (auth.uid() = host_id);

-- ── push_subscriptions ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "push_subscriptions_select_own" ON push_subscriptions;
CREATE POLICY "push_subscriptions_select_own"
  ON push_subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "push_subscriptions_insert_own" ON push_subscriptions;
CREATE POLICY "push_subscriptions_insert_own"
  ON push_subscriptions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "push_subscriptions_delete_own" ON push_subscriptions;
CREATE POLICY "push_subscriptions_delete_own"
  ON push_subscriptions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ── career_history ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "career_history_select_authenticated" ON career_history;
CREATE POLICY "career_history_select_authenticated"
  ON career_history FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "career_history_insert_own" ON career_history;
CREATE POLICY "career_history_insert_own"
  ON career_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS "career_history_update_own" ON career_history;
CREATE POLICY "career_history_update_own"
  ON career_history FOR UPDATE TO authenticated
  USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS "career_history_delete_own" ON career_history;
CREATE POLICY "career_history_delete_own"
  ON career_history FOR DELETE TO authenticated USING (auth.uid() = profile_id);

-- ── availability_slots ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "slots_select_own"    ON availability_slots;
DROP POLICY IF EXISTS "slots_select_others" ON availability_slots;
-- Any authenticated user can read slots (needed for PublicProfile availability display)
CREATE POLICY "slots_select_others"
  ON availability_slots FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "slots_insert_own" ON availability_slots;
CREATE POLICY "slots_insert_own"
  ON availability_slots FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "slots_update_own" ON availability_slots;
CREATE POLICY "slots_update_own"
  ON availability_slots FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "slots_delete_own" ON availability_slots;
CREATE POLICY "slots_delete_own"
  ON availability_slots FOR DELETE USING (auth.uid() = user_id);

-- ── marketplace_listings ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "marketplace_select_active" ON marketplace_listings;
CREATE POLICY "marketplace_select_active"
  ON marketplace_listings FOR SELECT TO authenticated USING (status = 'active');

DROP POLICY IF EXISTS "marketplace_insert_own" ON marketplace_listings;
CREATE POLICY "marketplace_insert_own"
  ON marketplace_listings FOR INSERT TO authenticated WITH CHECK (seller_id = auth.uid());

DROP POLICY IF EXISTS "marketplace_update_own" ON marketplace_listings;
CREATE POLICY "marketplace_update_own"
  ON marketplace_listings FOR UPDATE TO authenticated
  USING (seller_id = auth.uid()) WITH CHECK (seller_id = auth.uid());

DROP POLICY IF EXISTS "marketplace_delete_own" ON marketplace_listings;
CREATE POLICY "marketplace_delete_own"
  ON marketplace_listings FOR DELETE TO authenticated USING (seller_id = auth.uid());

-- ── student_posts ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "student_posts_owner"              ON student_posts;
DROP POLICY IF EXISTS "student_posts_insert_own"         ON student_posts;
DROP POLICY IF EXISTS "student_posts_update_own"         ON student_posts;
DROP POLICY IF EXISTS "student_posts_delete_own"         ON student_posts;
-- Owner has full control over their own posts
CREATE POLICY "student_posts_owner"
  ON student_posts FOR ALL
  USING  (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "student_posts_read_open"          ON student_posts;
DROP POLICY IF EXISTS "student_posts_select"             ON student_posts;
DROP POLICY IF EXISTS "student_posts_read_open_or_admin" ON student_posts;
-- Admin sees all; others see open posts or their own (even if closed)
CREATE POLICY "student_posts_read_open_or_admin"
  ON student_posts FOR SELECT
  USING (public.is_admin() OR is_closed = false OR student_id = auth.uid());

-- ── meeting_requests ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "meeting_requests_select" ON meeting_requests;
CREATE POLICY "meeting_requests_select"
  ON meeting_requests FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR recipient_id = auth.uid());

DROP POLICY IF EXISTS "meeting_requests_insert" ON meeting_requests;
CREATE POLICY "meeting_requests_insert"
  ON meeting_requests FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid());

DROP POLICY IF EXISTS "meeting_requests_update" ON meeting_requests;
CREATE POLICY "meeting_requests_update"
  ON meeting_requests FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid()) WITH CHECK (recipient_id = auth.uid());

DROP POLICY IF EXISTS "meeting_requests_delete" ON meeting_requests;
CREATE POLICY "meeting_requests_delete"
  ON meeting_requests FOR DELETE TO authenticated
  USING (requester_id = auth.uid());


-- ════════════════════════════════════════════════════════════════
-- STORAGE POLICIES
-- ════════════════════════════════════════════════════════════════
-- NOTE: The 'avatars' and 'marketplace-photos' buckets must be created
-- via Supabase Dashboard → Storage before these policies take effect.

-- avatars
DROP POLICY IF EXISTS "Avatar objects are publicly readable" ON storage.objects;
CREATE POLICY "Avatar objects are publicly readable"
  ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
CREATE POLICY "Users can delete their own avatar"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- marketplace-photos
DROP POLICY IF EXISTS "marketplace_photos_read"   ON storage.objects;
CREATE POLICY "marketplace_photos_read"
  ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'marketplace-photos');

DROP POLICY IF EXISTS "marketplace_photos_insert" ON storage.objects;
CREATE POLICY "marketplace_photos_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'marketplace-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "marketplace_photos_delete" ON storage.objects;
CREATE POLICY "marketplace_photos_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'marketplace-photos' AND (storage.foldername(name))[1] = auth.uid()::text);


-- ════════════════════════════════════════════════════════════════
-- REALTIME
-- ════════════════════════════════════════════════════════════════
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE messages;      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE conversations; EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ════════════════════════════════════════════════════════════════
-- HOW TO BECOME ADMIN
-- ════════════════════════════════════════════════════════════════
-- 1. Sign up normally through the app (any email, any role)
-- 2. Run this in Supabase SQL Editor (replace with your email):
--
--   UPDATE public.profiles
--   SET role = 'admin'
--   WHERE id = (SELECT id FROM auth.users WHERE email = 'your@email.com');
--
-- The email validation trigger only fires on INSERT, not UPDATE, so
-- this is safe regardless of your email domain.


NOTIFY pgrst, 'reload schema';


-- ════════════════════════════════════════════════════════════════
-- ROUND 2 — Migrations 023..056 net additions
-- ════════════════════════════════════════════════════════════════
-- Everything below is idempotent. Skipped migrations:
--   033 employer_mentor_approval  → reversed by 050
--   042 email_verification_gate   → reversed by 049
--   038 normalize_display_names   → one-shot UPDATE; fresh DBs have nothing to fix
-- ----------------------------------------------------------------

-- 026 — job_type_enum extensions (ALTER TYPE ADD VALUE IF NOT EXISTS
-- is idempotent on Postgres 12+; each in its own statement so a Supabase
-- migration runner that wraps statements in transactions still applies).
ALTER TYPE job_type_enum ADD VALUE IF NOT EXISTS 'mentorship';
ALTER TYPE job_type_enum ADD VALUE IF NOT EXISTS 'shadow';
ALTER TYPE job_type_enum ADD VALUE IF NOT EXISTS 'other';

-- 052 — application_status intermediate values
ALTER TYPE application_status ADD VALUE IF NOT EXISTS 'interview_scheduled';
ALTER TYPE application_status ADD VALUE IF NOT EXISTS 'offer_sent';
ALTER TYPE application_status ADD VALUE IF NOT EXISTS 'started';
ALTER TYPE application_status ADD VALUE IF NOT EXISTS 'completed';
ALTER TYPE application_status ADD VALUE IF NOT EXISTS 'withdrawn_by_employer';

-- account_status enum (introduced in 033 for the approval gate; the
-- gate itself is gone but the column + 'disabled' state still drive
-- admin ban-from-report flow).
DO $$ BEGIN CREATE TYPE public.account_status_t AS ENUM ('pending', 'active', 'disabled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ── profiles: column additions ──────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS share_grade_with_employers BOOLEAN NOT NULL DEFAULT FALSE,  -- 031
  ADD COLUMN IF NOT EXISTS share_grade_with_staff      BOOLEAN NOT NULL DEFAULT TRUE,  -- 047
  ADD COLUMN IF NOT EXISTS account_status              public.account_status_t NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS meeting_request_mode        TEXT NOT NULL DEFAULT 'flexible'; -- 054

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_meeting_request_mode_chk;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_meeting_request_mode_chk
    CHECK (meeting_request_mode IN ('flexible', 'slots'));


-- ── jobs: column + check additions ──────────────────────────────
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS compensation TEXT;  -- 039

-- 027 — non-blank checks (idempotent via NOT VALID + drop/add)
ALTER TABLE public.jobs
  DROP CONSTRAINT IF EXISTS jobs_title_not_blank;
ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_title_not_blank CHECK (length(btrim(title)) > 0);
ALTER TABLE public.jobs
  DROP CONSTRAINT IF EXISTS jobs_company_not_blank;
ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_company_not_blank CHECK (length(btrim(company)) > 0);
ALTER TABLE public.jobs
  DROP CONSTRAINT IF EXISTS jobs_location_not_blank;
ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_location_not_blank CHECK (length(btrim(location)) > 0);
ALTER TABLE public.jobs
  DROP CONSTRAINT IF EXISTS jobs_description_not_blank;
ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_description_not_blank CHECK (length(btrim(description)) > 0);

-- 039 — compensation max length
ALTER TABLE public.jobs
  DROP CONSTRAINT IF EXISTS jobs_compensation_max;
ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_compensation_max CHECK (compensation IS NULL OR char_length(compensation) <= 200);


-- ── applications: resume link CHECK (048) ──────────────────────
ALTER TABLE public.applications
  DROP CONSTRAINT IF EXISTS applications_resume_link_format;
ALTER TABLE public.applications
  ADD CONSTRAINT applications_resume_link_format
    CHECK (
      resume_link IS NULL
      OR resume_link ~* '^https?://[^\s]+$'
    );


-- ── events: richer fields (041) ─────────────────────────────────
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS all_day            BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS end_time           TEXT,
  ADD COLUMN IF NOT EXISTS registration_link  TEXT,
  ADD COLUMN IF NOT EXISTS capacity           INTEGER;

UPDATE public.events SET all_day = TRUE WHERE time IS NULL AND all_day = FALSE;

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_capacity_positive;
ALTER TABLE public.events
  ADD CONSTRAINT events_capacity_positive
    CHECK (capacity IS NULL OR capacity > 0);

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_registration_link_format;
ALTER TABLE public.events
  ADD CONSTRAINT events_registration_link_format
    CHECK (
      registration_link IS NULL
      OR registration_link ~* '^https?://[^\s]+$'
    );

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_time_consistency;
ALTER TABLE public.events
  ADD CONSTRAINT events_time_consistency
    CHECK (
      (all_day = TRUE  AND time IS NULL AND end_time IS NULL)
      OR
      (all_day = FALSE AND time IS NOT NULL)
    );


-- ── messages: is_system flag (051) ──────────────────────────────
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE;


-- ── new tables (035, 036, 040, 053, 055, 056) ───────────────────

-- 035 user_reports
CREATE TABLE IF NOT EXISTS public.user_reports (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id   UUID         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_id   UUID         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason        TEXT         NOT NULL CHECK (length(btrim(reason)) > 0),
  status        TEXT         NOT NULL DEFAULT 'open'
                              CHECK (status IN ('open','reviewed','actioned')),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  reviewed_at   TIMESTAMPTZ,
  reviewer_id   UUID         REFERENCES public.profiles(id) ON DELETE SET NULL
);
ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;

-- 036 notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_id   TEXT,
  link        TEXT         NOT NULL,
  title       TEXT         NOT NULL,
  subtitle    TEXT,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications (user_id, read_at, created_at DESC);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 040 saved_jobs
CREATE TABLE IF NOT EXISTS public.saved_jobs (
  user_id     UUID         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  job_id      UUID         NOT NULL REFERENCES public.jobs(id)     ON DELETE CASCADE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, job_id)
);
ALTER TABLE public.saved_jobs ENABLE ROW LEVEL SECURITY;

-- 053 applicant_notes
CREATE TABLE IF NOT EXISTS public.applicant_notes (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id        UUID         NOT NULL REFERENCES public.jobs(id)     ON DELETE CASCADE,
  applicant_id  UUID         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_id     UUID         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body          TEXT         NOT NULL CHECK (char_length(body) <= 4000),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (job_id, applicant_id, author_id)
);
CREATE INDEX IF NOT EXISTS idx_applicant_notes_job
  ON public.applicant_notes (job_id, applicant_id);
ALTER TABLE public.applicant_notes ENABLE ROW LEVEL SECURITY;

-- 055 opportunity_views + RPC
CREATE TABLE IF NOT EXISTS public.opportunity_views (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      UUID         NOT NULL REFERENCES public.jobs(id)     ON DELETE CASCADE,
  viewer_id   UUID         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source      TEXT         NOT NULL DEFAULT 'direct'
                            CHECK (source IN ('explore','opportunities','student-posts','feed','direct','saved','employer','notification')),
  viewed_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_opportunity_views_job_time
  ON public.opportunity_views (job_id, viewed_at DESC);
ALTER TABLE public.opportunity_views ENABLE ROW LEVEL SECURITY;

-- 056 company_meta
CREATE TABLE IF NOT EXISTS public.company_meta (
  name_key      TEXT         PRIMARY KEY,
  display_name  TEXT         NOT NULL,
  description   TEXT
                              CHECK (description IS NULL OR char_length(description) <= 500),
  logo_url      TEXT
                              CHECK (logo_url IS NULL OR logo_url ~* '^https?://[^\s]+$'),
  website_url   TEXT
                              CHECK (website_url IS NULL OR website_url ~* '^https?://[^\s]+$'),
  hq_location   TEXT
                              CHECK (hq_location IS NULL OR char_length(hq_location) <= 200),
  industry      TEXT
                              CHECK (industry IS NULL OR char_length(industry) <= 100),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_by    UUID         REFERENCES public.profiles(id) ON DELETE SET NULL
);
ALTER TABLE public.company_meta ENABLE ROW LEVEL SECURITY;


-- ── 037 — block same-role DM trigger ────────────────────────────
CREATE OR REPLACE FUNCTION public.conversations_block_same_role_trg()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  role_one public.profiles.role%TYPE;
  role_two public.profiles.role%TYPE;
BEGIN
  SELECT role INTO role_one FROM public.profiles WHERE id = NEW.participant_one;
  SELECT role INTO role_two FROM public.profiles WHERE id = NEW.participant_two;
  IF role_one IS NULL OR role_two IS NULL THEN RETURN NEW; END IF;
  IF role_one = 'admin' OR role_two = 'admin' THEN RETURN NEW; END IF;
  IF role_one = role_two THEN
    RAISE EXCEPTION 'crms: same-role conversations are not allowed (% ↔ %)', role_one, role_two
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS conversations_block_same_role ON public.conversations;
CREATE TRIGGER conversations_block_same_role
  BEFORE INSERT ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.conversations_block_same_role_trg();


-- ── 043 — validate_profile_email_role on INSERT *or* UPDATE OF role ──
DROP TRIGGER IF EXISTS validate_profile_before_insert ON public.profiles;
DROP TRIGGER IF EXISTS validate_profile_email_role_iud ON public.profiles;
CREATE TRIGGER validate_profile_email_role_iud
  BEFORE INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.validate_profile_email_role();


-- ── 044 — count-query indexes ───────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_directory_visible
  ON public.profiles (role)
  WHERE banned_at IS NULL
    AND account_status NOT IN ('pending', 'disabled');

CREATE INDEX IF NOT EXISTS idx_meeting_requests_recipient_pending
  ON public.meeting_requests (recipient_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_messages_conversation_unread
  ON public.messages (conversation_id)
  WHERE is_read = FALSE;

CREATE INDEX IF NOT EXISTS idx_conversations_participant_one
  ON public.conversations (participant_one);
CREATE INDEX IF NOT EXISTS idx_conversations_participant_two
  ON public.conversations (participant_two);


-- ── 045 — directory_member_count() (post-049 version) ───────────
CREATE OR REPLACE FUNCTION public.directory_member_count()
RETURNS INTEGER LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int
    FROM public.profiles p
   WHERE p.role <> 'admin'
     AND p.banned_at IS NULL
     AND p.account_status NOT IN ('pending', 'disabled');
$$;
GRANT EXECUTE ON FUNCTION public.directory_member_count() TO authenticated, anon;


-- ── 046 — student_posts: one open post per student ─────────────
CREATE UNIQUE INDEX IF NOT EXISTS student_posts_one_open_per_student
  ON public.student_posts (student_id)
  WHERE is_closed = FALSE;


-- ── 055 — opportunity_view_stats() ─────────────────────────────
CREATE OR REPLACE FUNCTION public.opportunity_view_stats(job_ids UUID[])
RETURNS TABLE (
  job_id              UUID,
  views_30d           BIGINT,
  unique_viewers_30d  BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    v.job_id,
    count(*) AS views_30d,
    count(DISTINCT v.viewer_id) AS unique_viewers_30d
  FROM public.opportunity_views v
  WHERE v.job_id = ANY(job_ids)
    AND v.viewed_at >= now() - interval '30 days'
    AND (
      public.is_admin()
      OR auth.uid() = (SELECT posted_by FROM public.jobs WHERE id = v.job_id)
    )
  GROUP BY v.job_id;
$$;
GRANT EXECUTE ON FUNCTION public.opportunity_view_stats(UUID[]) TO authenticated;


-- ── RLS for the new tables ──────────────────────────────────────
-- user_reports (035)
DROP POLICY IF EXISTS user_reports_insert_self ON public.user_reports;
CREATE POLICY user_reports_insert_self
  ON public.user_reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);
DROP POLICY IF EXISTS user_reports_select_admin ON public.user_reports;
CREATE POLICY user_reports_select_admin
  ON public.user_reports FOR SELECT TO authenticated
  USING (public.is_admin());
DROP POLICY IF EXISTS user_reports_update_admin ON public.user_reports;
CREATE POLICY user_reports_update_admin
  ON public.user_reports FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- notifications (036)
DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
CREATE POLICY notifications_select_own
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS notifications_update_own ON public.notifications;
CREATE POLICY notifications_update_own
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- saved_jobs (040)
DROP POLICY IF EXISTS saved_jobs_select_own ON public.saved_jobs;
CREATE POLICY saved_jobs_select_own
  ON public.saved_jobs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS saved_jobs_insert_own ON public.saved_jobs;
CREATE POLICY saved_jobs_insert_own
  ON public.saved_jobs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS saved_jobs_delete_own ON public.saved_jobs;
CREATE POLICY saved_jobs_delete_own
  ON public.saved_jobs FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- applicant_notes (053)
DROP POLICY IF EXISTS applicant_notes_select_owner_or_admin ON public.applicant_notes;
CREATE POLICY applicant_notes_select_owner_or_admin
  ON public.applicant_notes FOR SELECT
  USING (
    public.is_admin()
    OR auth.uid() = (SELECT posted_by FROM public.jobs WHERE id = job_id)
  );
DROP POLICY IF EXISTS applicant_notes_insert_owner ON public.applicant_notes;
CREATE POLICY applicant_notes_insert_owner
  ON public.applicant_notes FOR INSERT
  WITH CHECK (
    auth.uid() = author_id
    AND auth.uid() = (SELECT posted_by FROM public.jobs WHERE id = job_id)
  );
DROP POLICY IF EXISTS applicant_notes_update_owner ON public.applicant_notes;
CREATE POLICY applicant_notes_update_owner
  ON public.applicant_notes FOR UPDATE
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS applicant_notes_delete_owner ON public.applicant_notes;
CREATE POLICY applicant_notes_delete_owner
  ON public.applicant_notes FOR DELETE
  USING (auth.uid() = author_id);

-- opportunity_views (055)
DROP POLICY IF EXISTS opportunity_views_insert_self ON public.opportunity_views;
CREATE POLICY opportunity_views_insert_self
  ON public.opportunity_views FOR INSERT
  WITH CHECK (
    auth.uid() = viewer_id
    AND auth.uid() <> (SELECT posted_by FROM public.jobs WHERE id = job_id)
  );
DROP POLICY IF EXISTS opportunity_views_select_owner ON public.opportunity_views;
CREATE POLICY opportunity_views_select_owner
  ON public.opportunity_views FOR SELECT
  USING (
    public.is_admin()
    OR auth.uid() = (SELECT posted_by FROM public.jobs WHERE id = job_id)
  );

-- company_meta (056) — anyone authed reads; only posters under that
-- name (or admins) write.
DROP POLICY IF EXISTS company_meta_select ON public.company_meta;
CREATE POLICY company_meta_select
  ON public.company_meta FOR SELECT TO authenticated
  USING (TRUE);
DROP POLICY IF EXISTS company_meta_insert_poster ON public.company_meta;
CREATE POLICY company_meta_insert_poster
  ON public.company_meta FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.jobs j
       WHERE lower(j.company) = name_key
         AND j.posted_by = auth.uid()
    )
  );
DROP POLICY IF EXISTS company_meta_update_poster ON public.company_meta;
CREATE POLICY company_meta_update_poster
  ON public.company_meta FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.jobs j
       WHERE lower(j.company) = name_key
         AND j.posted_by = auth.uid()
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.jobs j
       WHERE lower(j.company) = name_key
         AND j.posted_by = auth.uid()
    )
  );
DROP POLICY IF EXISTS company_meta_delete_admin ON public.company_meta;
CREATE POLICY company_meta_delete_admin
  ON public.company_meta FOR DELETE TO authenticated
  USING (public.is_admin());


-- ── 030 — hide admin profiles from cross-row SELECT ─────────────
-- (Owner can still read their own admin row; admins can read all.)
DROP POLICY IF EXISTS profiles_hide_admin_rows ON public.profiles;
CREATE POLICY profiles_hide_admin_rows
  ON public.profiles AS RESTRICTIVE FOR SELECT
  USING (
    role <> 'admin'
    OR id = auth.uid()
    OR public.is_admin()
  );


-- ════════════════════════════════════════════════════════════════
-- Round 3 appendix — migrations 057–080 folded into the bootstrap.
-- Everything below is idempotent (CREATE OR REPLACE / DROP IF
-- EXISTS / ADD IF NOT EXISTS) so applying 000 on a fresh DB or on
-- top of an already-migrated DB both land in the same state.
-- ════════════════════════════════════════════════════════════════

-- ── 057 — drop the same-role DM-block trigger ───────────────────
DROP TRIGGER IF EXISTS messages_block_same_role ON public.messages;
DROP FUNCTION IF EXISTS public.messages_block_same_role_trg();

-- ── 060 — extend opportunity_view_stats output ──────────────────
-- (no schema change beyond the function; see migration 055 + 060)

-- ── 061 — mentorship pause + 062 — jobs draft + 064 — notif prefs
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mentorship_paused_until DATE,
  ADD COLUMN IF NOT EXISTS notification_preferences JSONB;
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS is_draft BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 063 — resume uploads ────────────────────────────────────────
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS resume_path TEXT;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'resumes', 'resumes', FALSE, 5 * 1024 * 1024,
  ARRAY['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ── 065 — mentor visibility card seen ───────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS seen_mentor_visibility_card BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 066 — student profile sections ──────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS skills TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS projects JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS links JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS default_resume_path TEXT;
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_skills_max12;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_skills_max12
    CHECK (array_length(skills, 1) IS NULL OR array_length(skills, 1) <= 12);
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_projects_shape;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_projects_shape
    CHECK (jsonb_typeof(projects) = 'array' AND jsonb_array_length(projects) <= 4);
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_links_shape;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_links_shape CHECK (jsonb_typeof(links) = 'object');
-- Resume-path CHECK is widened by 078 below to accept PDF or DOCX.

-- ── 067 — mentor shortlist (a.k.a. saved candidates) ────────────
CREATE TABLE IF NOT EXISTS public.mentor_shortlist (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT mentor_shortlist_unique UNIQUE (mentor_id, student_id),
  CONSTRAINT mentor_shortlist_note_len CHECK (note IS NULL OR char_length(note) <= 200),
  CONSTRAINT mentor_shortlist_no_self CHECK (mentor_id <> student_id)
);
CREATE INDEX IF NOT EXISTS mentor_shortlist_mentor_idx
  ON public.mentor_shortlist (mentor_id, created_at DESC);
ALTER TABLE public.mentor_shortlist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mentor_shortlist_select_own ON public.mentor_shortlist;
CREATE POLICY mentor_shortlist_select_own ON public.mentor_shortlist FOR SELECT TO authenticated
  USING (auth.uid() = mentor_id);
DROP POLICY IF EXISTS mentor_shortlist_insert_own ON public.mentor_shortlist;
CREATE POLICY mentor_shortlist_insert_own ON public.mentor_shortlist FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = mentor_id);
DROP POLICY IF EXISTS mentor_shortlist_update_own ON public.mentor_shortlist;
CREATE POLICY mentor_shortlist_update_own ON public.mentor_shortlist FOR UPDATE TO authenticated
  USING (auth.uid() = mentor_id) WITH CHECK (auth.uid() = mentor_id);
DROP POLICY IF EXISTS mentor_shortlist_delete_own ON public.mentor_shortlist;
CREATE POLICY mentor_shortlist_delete_own ON public.mentor_shortlist FOR DELETE TO authenticated
  USING (auth.uid() = mentor_id);

-- ── 068 — IANA timezone on availability slots ───────────────────
ALTER TABLE public.availability_slots
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/Denver';
ALTER TABLE public.availability_slots
  DROP CONSTRAINT IF EXISTS availability_slots_timezone_shape;
ALTER TABLE public.availability_slots
  ADD CONSTRAINT availability_slots_timezone_shape
    CHECK (char_length(timezone) BETWEEN 3 AND 64 AND timezone ~ '^[A-Za-z]+(/[A-Za-z_\-+0-9]+){0,2}$');

-- ── 069 — typed custom application questions (≤5) ──────────────
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS custom_questions_v2 JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.jobs
  DROP CONSTRAINT IF EXISTS jobs_custom_questions_max3;
ALTER TABLE public.jobs
  DROP CONSTRAINT IF EXISTS jobs_custom_questions_v2_shape;
ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_custom_questions_v2_shape
    CHECK (jsonb_typeof(custom_questions_v2) = 'array' AND jsonb_array_length(custom_questions_v2) <= 5);

-- ── 070 — opt-in public Mentor Wall ─────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS show_on_mentor_wall BOOLEAN NOT NULL DEFAULT FALSE;
CREATE OR REPLACE FUNCTION public.list_mentor_wall()
RETURNS TABLE (
  id           UUID,
  full_name    TEXT,
  avatar_url   TEXT,
  company      TEXT,
  industry     TEXT,
  mentor_type  TEXT,
  mentor_type_other TEXT
) LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT id, full_name, avatar_url, company, industry, mentor_type::text, mentor_type_other
    FROM public.profiles
   WHERE role = 'employer_mentor'
     AND show_on_mentor_wall = TRUE
     AND coalesce(banned_at, 'epoch'::timestamptz) <= 'epoch'::timestamptz
   ORDER BY created_at DESC
   LIMIT 60;
$$;
REVOKE ALL ON FUNCTION public.list_mentor_wall() FROM public;
GRANT EXECUTE ON FUNCTION public.list_mentor_wall() TO anon, authenticated;

-- ── 071 / 076 — community_stats() (single source of truth) ──────
DROP FUNCTION IF EXISTS public.community_stats();
CREATE OR REPLACE FUNCTION public.community_stats()
RETURNS TABLE (
  members              BIGINT,
  students             BIGINT,
  mentors              BIGINT,
  companies            BIGINT,
  opportunities_active BIGINT
) LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT
    (SELECT count(*) FROM public.profiles
       WHERE role <> 'admin'
         AND coalesce(banned_at, 'epoch'::timestamptz) <= 'epoch'::timestamptz),
    (SELECT count(*) FROM public.profiles
       WHERE role = 'student'
         AND coalesce(array_length(interests, 1), 0) >= 1
         AND coalesce(banned_at, 'epoch'::timestamptz) <= 'epoch'::timestamptz),
    (SELECT count(*) FROM public.profiles
       WHERE role = 'employer_mentor'
         AND open_to_mentorship = TRUE
         AND coalesce(banned_at, 'epoch'::timestamptz) <= 'epoch'::timestamptz),
    (SELECT count(DISTINCT btrim(company)) FROM public.jobs
       WHERE is_active = TRUE
         AND coalesce(is_draft, FALSE) = FALSE
         AND company IS NOT NULL
         AND btrim(company) <> ''),
    (SELECT count(*) FROM public.jobs
       WHERE is_active = TRUE
         AND coalesce(is_draft, FALSE) = FALSE
         AND (deadline IS NULL OR deadline >= current_date));
$$;
REVOKE ALL ON FUNCTION public.community_stats() FROM public;
GRANT EXECUTE ON FUNCTION public.community_stats() TO anon, authenticated;

-- ── 072 — invite tracking ───────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS invited_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_invited_by_not_self;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_invited_by_not_self
    CHECK (invited_by_user_id IS NULL OR invited_by_user_id <> id);
CREATE INDEX IF NOT EXISTS profiles_invited_by_idx
  ON public.profiles (invited_by_user_id) WHERE invited_by_user_id IS NOT NULL;

-- ── 073 — server-side text filter for slurs / grooming-adjacent ─
CREATE OR REPLACE FUNCTION public.text_has_blocked_terms(input TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  flat TEXT; pat TEXT;
  pats TEXT[] := ARRAY[
    '[n][i1!][g][g3][3e][r]','[n][i1!][g][g3][3e][a4@]','[f][a4@][g][g][o0][t7]',
    '[r][3e][t7][a4@][r][d]','[t7][r][a4@][n][n][y]','[k][i1!][k][3e]',
    '[s$5][p][i1!][c]','[c][h][i1!][n][k]','[g][o0][o0][k]',
    '[w][3e][t7][b][a4@][c][k]','[c][o0][o0][n]','[c][u][n][t7]',
    '[p][3e][d][o0]','[r][a4@][p][i1!][s$5][t7]','[m][o0][l][3e][s$5][t7][3e][r]',
    'likeslittleboys','likeslittlegirls','lickslittleboys','lickslittlegirls'
  ];
BEGIN
  IF input IS NULL OR length(input) = 0 THEN RETURN FALSE; END IF;
  flat := regexp_replace(lower(input), '[^a-z0-9$@!]+', '', 'g');
  IF flat = '' THEN RETURN FALSE; END IF;
  FOREACH pat IN ARRAY pats LOOP
    IF flat ~ pat THEN RETURN TRUE; END IF;
  END LOOP;
  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.profiles_check_text_filter_trg()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF public.text_has_blocked_terms(NEW.full_name) THEN
    RAISE EXCEPTION 'crms: blocked term in name'
      USING ERRCODE = 'check_violation', HINT = 'blocked_term:name';
  END IF;
  IF public.text_has_blocked_terms(NEW.bio) THEN
    RAISE EXCEPTION 'crms: blocked term in bio'
      USING ERRCODE = 'check_violation', HINT = 'blocked_term:bio';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS profiles_check_text_filter ON public.profiles;
CREATE TRIGGER profiles_check_text_filter
  BEFORE INSERT OR UPDATE OF full_name, bio ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_check_text_filter_trg();

CREATE OR REPLACE FUNCTION public.jobs_check_text_filter_trg()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF public.text_has_blocked_terms(NEW.title)
     OR public.text_has_blocked_terms(NEW.description)
     OR public.text_has_blocked_terms(NEW.how_to_apply)
     OR public.text_has_blocked_terms(NEW.company) THEN
    RAISE EXCEPTION 'crms: blocked term in opportunity text'
      USING ERRCODE = 'check_violation', HINT = 'blocked_term:opportunity';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS jobs_check_text_filter ON public.jobs;
CREATE TRIGGER jobs_check_text_filter
  BEFORE INSERT OR UPDATE OF title, description, how_to_apply, company ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.jobs_check_text_filter_trg();

CREATE OR REPLACE FUNCTION public.student_posts_check_text_filter_trg()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF public.text_has_blocked_terms(NEW.pitch) THEN
    RAISE EXCEPTION 'crms: blocked term in student post'
      USING ERRCODE = 'check_violation', HINT = 'blocked_term:student_post';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS student_posts_check_text_filter ON public.student_posts;
CREATE TRIGGER student_posts_check_text_filter
  BEFORE INSERT OR UPDATE OF pitch ON public.student_posts
  FOR EACH ROW EXECUTE FUNCTION public.student_posts_check_text_filter_trg();

CREATE OR REPLACE FUNCTION public.messages_check_text_filter_trg()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF public.text_has_blocked_terms(NEW.content) THEN
    RAISE EXCEPTION 'crms: blocked term in message'
      USING ERRCODE = 'check_violation', HINT = 'blocked_term:message';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS messages_check_text_filter ON public.messages;
CREATE TRIGGER messages_check_text_filter
  BEFORE INSERT OR UPDATE OF content ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.messages_check_text_filter_trg();

CREATE OR REPLACE FUNCTION public.applications_check_text_filter_trg()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF public.text_has_blocked_terms(NEW.cover_note) THEN
    RAISE EXCEPTION 'crms: blocked term in cover note'
      USING ERRCODE = 'check_violation', HINT = 'blocked_term:application';
  END IF;
  IF NEW.custom_answers IS NOT NULL
     AND public.text_has_blocked_terms(NEW.custom_answers::text) THEN
    RAISE EXCEPTION 'crms: blocked term in custom answers'
      USING ERRCODE = 'check_violation', HINT = 'blocked_term:application';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS applications_check_text_filter ON public.applications;
CREATE TRIGGER applications_check_text_filter
  BEFORE INSERT OR UPDATE OF cover_note, custom_answers ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.applications_check_text_filter_trg();

-- ── 074 — student outreach consent ──────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS student_outreach_consent BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION public.messages_check_outreach_consent_trg()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sender_role public.role_type; conv_p1 UUID; conv_p2 UUID;
  other_id UUID; other_role public.role_type;
  other_consent BOOLEAN; prior_msg_count BIGINT;
BEGIN
  SELECT role INTO sender_role FROM public.profiles WHERE id = NEW.sender_id;
  IF sender_role IS DISTINCT FROM 'employer_mentor' THEN RETURN NEW; END IF;
  SELECT participant_one, participant_two INTO conv_p1, conv_p2
    FROM public.conversations WHERE id = NEW.conversation_id;
  IF conv_p1 IS NULL THEN
    RAISE EXCEPTION 'crms: conversation not found' USING ERRCODE = 'foreign_key_violation';
  END IF;
  other_id := CASE WHEN conv_p1 = NEW.sender_id THEN conv_p2 ELSE conv_p1 END;
  SELECT role, student_outreach_consent INTO other_role, other_consent
    FROM public.profiles WHERE id = other_id;
  IF other_role IS DISTINCT FROM 'student' THEN RETURN NEW; END IF;
  SELECT count(*) INTO prior_msg_count
    FROM public.messages m
   WHERE m.conversation_id = NEW.conversation_id AND m.sender_id = other_id;
  IF prior_msg_count > 0 THEN RETURN NEW; END IF;
  IF NOT coalesce(other_consent, FALSE) THEN
    RAISE EXCEPTION 'crms: student is not accepting outreach'
      USING ERRCODE = 'check_violation', HINT = 'no_outreach_consent';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS messages_check_outreach_consent ON public.messages;
CREATE TRIGGER messages_check_outreach_consent
  BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.messages_check_outreach_consent_trg();

CREATE OR REPLACE FUNCTION public.conversations_check_outreach_consent_trg()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  initiator_role public.role_type; target_role public.role_type;
  target_consent BOOLEAN; initiator_id UUID; target_id UUID;
BEGIN
  initiator_id := auth.uid();
  IF initiator_id IS NULL THEN RETURN NEW; END IF;
  SELECT role INTO initiator_role FROM public.profiles WHERE id = initiator_id;
  IF initiator_role IS DISTINCT FROM 'employer_mentor' THEN RETURN NEW; END IF;
  target_id := CASE WHEN NEW.participant_one = initiator_id THEN NEW.participant_two ELSE NEW.participant_one END;
  SELECT role, student_outreach_consent INTO target_role, target_consent
    FROM public.profiles WHERE id = target_id;
  IF target_role IS DISTINCT FROM 'student' THEN RETURN NEW; END IF;
  IF NOT coalesce(target_consent, FALSE) THEN
    RAISE EXCEPTION 'crms: student is not accepting outreach'
      USING ERRCODE = 'check_violation', HINT = 'no_outreach_consent';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS conversations_check_outreach_consent ON public.conversations;
CREATE TRIGGER conversations_check_outreach_consent
  BEFORE INSERT ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.conversations_check_outreach_consent_trg();

-- ── 075 — mentor consent confirmation timestamp + auto-stamp ────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mentor_consent_confirmed_at TIMESTAMPTZ;
UPDATE public.profiles
   SET mentor_consent_confirmed_at = created_at
 WHERE role = 'employer_mentor'
   AND open_to_mentorship = TRUE
   AND mentor_consent_confirmed_at IS NULL;
CREATE OR REPLACE FUNCTION public.profiles_mentor_consent_stamp_trg()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.open_to_mentorship = TRUE
     AND (TG_OP = 'INSERT' OR OLD.open_to_mentorship IS DISTINCT FROM TRUE) THEN
    NEW.mentor_consent_confirmed_at := now();
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS profiles_mentor_consent_stamp ON public.profiles;
CREATE TRIGGER profiles_mentor_consent_stamp
  BEFORE INSERT OR UPDATE OF open_to_mentorship ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_mentor_consent_stamp_trg();

-- ── 077 — interest taxonomy (8 buckets) + specific_interests ────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS specific_interests TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_specific_interests_max20;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_specific_interests_max20
    CHECK (array_length(specific_interests, 1) IS NULL OR array_length(specific_interests, 1) <= 20);
-- Remap legacy interests on profiles + student_posts to the new
-- 8-bucket taxonomy. Re-running is a no-op (all old keys are gone
-- after the first pass).
WITH map(old_key, new_key) AS (VALUES
  ('Technology','Technology & Engineering'),
  ('Engineering','Technology & Engineering'),
  ('Architecture & Design','Technology & Engineering'),
  ('Finance & Banking','Finance, Business & Government'),
  ('Consulting','Finance, Business & Government'),
  ('Real Estate','Finance, Business & Government'),
  ('Government & Public Policy','Finance, Business & Government'),
  ('Law & Legal','Finance, Business & Government'),
  ('Healthcare & Medicine','Healthcare & Science'),
  ('Science & Research','Healthcare & Science'),
  ('Arts & Entertainment','Arts, Media & Communications'),
  ('Marketing & Communications','Arts, Media & Communications'),
  ('Environmental & Sustainability','Environment, Agriculture & Outdoors'),
  ('Agriculture & Ranching','Environment, Agriculture & Outdoors'),
  ('Education','Education & Social Impact'),
  ('Non-Profit & Social Impact','Education & Social Impact'),
  ('Hospitality & Tourism','Hospitality, Sports & Recreation'),
  ('Sports & Recreation','Hospitality, Sports & Recreation'),
  ('Other','Other'))
UPDATE public.profiles p
   SET interests = (
     SELECT array_agg(DISTINCT coalesce(m.new_key, raw)) FROM unnest(p.interests) AS raw
       LEFT JOIN map m ON m.old_key = raw
   )
 WHERE p.interests IS NOT NULL AND array_length(p.interests, 1) IS NOT NULL;

-- ── 078 — accept DOCX resumes (path CHECK + bucket MIME) ────────
ALTER TABLE public.applications
  DROP CONSTRAINT IF EXISTS applications_resume_path_pdf;
ALTER TABLE public.applications
  ADD CONSTRAINT applications_resume_path_pdf
    CHECK (resume_path IS NULL OR resume_path ~* '\.(pdf|docx)$');
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_default_resume_pdf;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_default_resume_pdf
    CHECK (default_resume_path IS NULL OR default_resume_path ~* '\.(pdf|docx)$');
-- Bucket MIME list was already widened above in the 063 INSERT … ON CONFLICT.

-- ── 079 — preferred_name ────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_name TEXT;
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_preferred_name_len;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_preferred_name_len
    CHECK (preferred_name IS NULL OR (char_length(preferred_name) BETWEEN 1 AND 40));

-- ── 072 + 079 — handle_new_user (replaces the 001 definition) ───
-- Reads invited_by (UUID) and preferred_name from the signup metadata
-- payload set by AuthContext.signUp.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  inviter UUID;
  pref    TEXT;
BEGIN
  BEGIN
    inviter := (NEW.raw_user_meta_data->>'invited_by')::uuid;
    IF inviter = NEW.id THEN inviter := NULL; END IF;
  EXCEPTION WHEN OTHERS THEN
    inviter := NULL;
  END;
  pref := NULLIF(btrim(NEW.raw_user_meta_data->>'preferred_name'), '');
  IF pref IS NOT NULL AND char_length(pref) > 40 THEN
    pref := substr(pref, 1, 40);
  END IF;
  INSERT INTO public.profiles (id, full_name, role, invited_by_user_id, preferred_name)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    (NEW.raw_user_meta_data->>'role')::public.role_type,
    inviter,
    pref
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RAISE;
END;
$$;

-- ── 080 — admin_delete_user(target_id) ──────────────────────────
CREATE OR REPLACE FUNCTION public.admin_delete_user(target_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE caller_role TEXT; target_role TEXT; admin_count BIGINT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'crms: not authenticated' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF target_id = auth.uid() THEN
    RAISE EXCEPTION 'crms: admins cannot delete themselves'
      USING ERRCODE = 'check_violation', HINT = 'self_delete_forbidden';
  END IF;
  SELECT role::text INTO caller_role FROM public.profiles WHERE id = auth.uid();
  IF caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'crms: admin only' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT role::text INTO target_role FROM public.profiles WHERE id = target_id;
  IF target_role IS NULL THEN
    RAISE EXCEPTION 'crms: user not found'
      USING ERRCODE = 'no_data_found', HINT = 'no_such_user';
  END IF;
  IF target_role = 'admin' THEN
    SELECT count(*) INTO admin_count FROM public.profiles WHERE role = 'admin';
    IF admin_count <= 1 THEN
      RAISE EXCEPTION 'crms: cannot delete the last admin'
        USING ERRCODE = 'check_violation', HINT = 'last_admin';
    END IF;
  END IF;
  DELETE FROM auth.users WHERE id = target_id;
  RETURN TRUE;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_delete_user(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated;


-- ────────────────────────────────────────────────────────────────
-- Reload PostgREST schema cache so all the additions are visible.
-- ────────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
