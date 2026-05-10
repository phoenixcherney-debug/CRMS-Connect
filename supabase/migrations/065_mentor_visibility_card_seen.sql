-- 065_mentor_visibility_card_seen.sql
-- Phase 1.2 — boolean to gate the post-signup "You're visible to students"
-- interstitial. We track it server-side rather than localStorage so the
-- card is shown exactly once per *account*, not per device.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS seen_mentor_visibility_card BOOLEAN
    NOT NULL DEFAULT FALSE;
