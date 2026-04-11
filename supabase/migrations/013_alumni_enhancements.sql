-- ============================================================
-- CRMS Connect — Alumni/Parent Enhancements
-- Adds: career history, mentorship availability, booking system
-- ============================================================

-- ─── Profile enhancements ──────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS industry TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS open_to_mentorship BOOLEAN DEFAULT FALSE NOT NULL;

-- ─── Career History ────────────────────────────────────────
CREATE TABLE career_history (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company    TEXT NOT NULL,
  title      TEXT NOT NULL,
  start_year INTEGER NOT NULL,
  end_year   INTEGER,
  is_current BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_career_history_profile ON career_history(profile_id);

ALTER TABLE career_history ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read career history (displayed on public profiles)
CREATE POLICY "career_history_select_authenticated"
  ON career_history FOR SELECT
  TO authenticated
  USING (true);

-- Users can only manage their own career history
CREATE POLICY "career_history_insert_own"
  ON career_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "career_history_update_own"
  ON career_history FOR UPDATE
  TO authenticated
  USING (auth.uid() = profile_id)
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "career_history_delete_own"
  ON career_history FOR DELETE
  TO authenticated
  USING (auth.uid() = profile_id);

-- ─── Availability Slots ────────────────────────────────────
-- Alumni/parents set recurring or one-off time blocks for mentorship
CREATE TABLE availability_slots (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  day_of_week   INTEGER,          -- 0=Sun..6=Sat, NULL for specific-date slots
  specific_date DATE,             -- NULL for recurring weekly slots
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT valid_slot CHECK (
    (day_of_week IS NOT NULL AND specific_date IS NULL)
    OR (day_of_week IS NULL AND specific_date IS NOT NULL)
  ),
  CONSTRAINT valid_time_range CHECK (start_time < end_time)
);

CREATE INDEX idx_availability_profile ON availability_slots(profile_id);

ALTER TABLE availability_slots ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read availability (students need to see it to book)
CREATE POLICY "availability_select_authenticated"
  ON availability_slots FOR SELECT
  TO authenticated
  USING (true);

-- Only the profile owner can manage their availability
CREATE POLICY "availability_insert_own"
  ON availability_slots FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "availability_update_own"
  ON availability_slots FOR UPDATE
  TO authenticated
  USING (auth.uid() = profile_id)
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "availability_delete_own"
  ON availability_slots FOR DELETE
  TO authenticated
  USING (auth.uid() = profile_id);

-- ─── Bookings ──────────────────────────────────────────────
CREATE TYPE booking_status AS ENUM ('confirmed', 'cancelled_by_student', 'cancelled_by_mentor');

CREATE TABLE bookings (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slot_id     UUID NOT NULL REFERENCES availability_slots(id) ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  mentor_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  booking_date DATE NOT NULL,
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  status      booking_status DEFAULT 'confirmed' NOT NULL,
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  -- Prevent double-booking the same mentor for the same date+time
  UNIQUE(mentor_id, booking_date, start_time)
);

CREATE INDEX idx_bookings_student ON bookings(student_id);
CREATE INDEX idx_bookings_mentor ON bookings(mentor_id);
CREATE INDEX idx_bookings_slot ON bookings(slot_id);

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Both the student and mentor can see their bookings
CREATE POLICY "bookings_select_participant"
  ON bookings FOR SELECT
  TO authenticated
  USING (
    auth.uid() = student_id
    OR auth.uid() = mentor_id
  );

-- Only students can create bookings (for themselves)
CREATE POLICY "bookings_insert_student"
  ON bookings FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = student_id
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'student'
  );

-- Both participants can update (for cancellation status changes)
CREATE POLICY "bookings_update_participant"
  ON bookings FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = student_id
    OR auth.uid() = mentor_id
  );
