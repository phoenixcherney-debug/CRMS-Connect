-- ─────────────────────────────────────────────────────────────────────────────
-- 021_meeting_requests.sql
-- Enables students to browse an EM's public availability slots and send
-- meeting requests. Also opens availability_slots for cross-user reads so
-- PublicProfile can show upcoming slots.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Allow any authenticated user to read any user's slots ─────────────────
-- The existing "slots_select_own" policy only allows the owner.
-- We add a separate policy so visitors can see upcoming slots on PublicProfile.
DROP POLICY IF EXISTS "slots_select_others" ON availability_slots;
CREATE POLICY "slots_select_others"
  ON availability_slots FOR SELECT
  TO authenticated
  USING (true);   -- any authenticated user can read; app layer filters by date

-- ── 2. meeting_requests table ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meeting_requests (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at            timestamptz DEFAULT now() NOT NULL,
  requester_id          uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  recipient_id          uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  slot_id               uuid REFERENCES availability_slots(id) ON DELETE SET NULL,
  requested_date        date NOT NULL,
  requested_start_time  time NOT NULL,
  requested_end_time    time NOT NULL,
  note                  text,
  status                text NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'accepted', 'declined')),
  CONSTRAINT no_self_request CHECK (requester_id <> recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_meeting_requests_requester ON meeting_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_meeting_requests_recipient ON meeting_requests(recipient_id);
CREATE INDEX IF NOT EXISTS idx_meeting_requests_slot      ON meeting_requests(slot_id);

-- ── 3. RLS for meeting_requests ───────────────────────────────────────────────
ALTER TABLE meeting_requests ENABLE ROW LEVEL SECURITY;

-- Each party can see requests they sent or received
DROP POLICY IF EXISTS "meeting_requests_select" ON meeting_requests;
CREATE POLICY "meeting_requests_select"
  ON meeting_requests FOR SELECT
  TO authenticated
  USING (requester_id = auth.uid() OR recipient_id = auth.uid());

-- Anyone authenticated can send a request (requester must be themselves)
DROP POLICY IF EXISTS "meeting_requests_insert" ON meeting_requests;
CREATE POLICY "meeting_requests_insert"
  ON meeting_requests FOR INSERT
  TO authenticated
  WITH CHECK (requester_id = auth.uid());

-- Requester can cancel (delete); recipient can update status (accept/decline)
DROP POLICY IF EXISTS "meeting_requests_update" ON meeting_requests;
CREATE POLICY "meeting_requests_update"
  ON meeting_requests FOR UPDATE
  TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

DROP POLICY IF EXISTS "meeting_requests_delete" ON meeting_requests;
CREATE POLICY "meeting_requests_delete"
  ON meeting_requests FOR DELETE
  TO authenticated
  USING (requester_id = auth.uid());
