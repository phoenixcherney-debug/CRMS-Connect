-- ============================================================
-- Migration 004: Events table + application delete policy
-- ============================================================

-- ─── Events table ─────────────────────────────────────────────
CREATE TYPE event_type AS ENUM ('career_fair', 'networking', 'workshop', 'info_session', 'other');

CREATE TABLE events (
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

CREATE INDEX idx_events_date ON events(date);
CREATE INDEX idx_events_host ON events(host_id);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read events
CREATE POLICY "events_select_authenticated"
  ON events FOR SELECT
  TO authenticated
  USING (true);

-- Only alumni/parents can create events
CREATE POLICY "events_insert_alumni_parent"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = host_id
    AND (
      SELECT role FROM profiles WHERE id = auth.uid()
    ) IN ('alumni', 'parent')
  );

-- Only the event host can update their events
CREATE POLICY "events_update_own"
  ON events FOR UPDATE
  TO authenticated
  USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);

-- Only the event host can delete their events
CREATE POLICY "events_delete_own"
  ON events FOR DELETE
  TO authenticated
  USING (auth.uid() = host_id);

-- ─── Allow students to delete (withdraw) their own pending applications ──
CREATE POLICY "applications_delete_own"
  ON applications FOR DELETE
  TO authenticated
  USING (
    auth.uid() = applicant_id
    AND status = 'pending'
  );

-- ─── Make jobs.deadline nullable for rolling opportunities ───
ALTER TABLE jobs ALTER COLUMN deadline DROP NOT NULL;
