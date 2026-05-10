-- 054_meeting_request_mode.sql
-- P2-14 — let mentors choose between two contact modes:
--   • 'flexible' (default for new mentors): students propose any date+time;
--     no calendar required.
--   • 'slots':                              the existing flow — students
--     pick from pre-set availability slots.
--
-- Stored as a TEXT (no enum) so we can iterate without a migration; CHECK
-- constraint pins the legal values.
--
-- The meeting_requests table already allows slot_id NULL, so flexible
-- requests slot in without further schema change.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS meeting_request_mode TEXT NOT NULL DEFAULT 'flexible';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_meeting_request_mode_chk;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_meeting_request_mode_chk
    CHECK (meeting_request_mode IN ('flexible', 'slots'));

COMMENT ON COLUMN public.profiles.meeting_request_mode IS
  'P2-14 — when open_to_mentorship is true, controls how students propose times. flexible = any time, slots = only published availability slots.';
