-- ============================================================
-- CRMS Connect — Full Database Setup (Migrations 001–022)
-- Safe to paste into Supabase SQL Editor on a fresh database.
-- Also idempotent: safe to re-run on an existing database.
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
