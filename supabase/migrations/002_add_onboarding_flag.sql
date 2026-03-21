-- ============================================================
-- CRMS Connect — Migration 002: Onboarding Flag
-- Run this in: Supabase Dashboard → Database → SQL Editor
-- ============================================================

-- Add onboarding_complete to track whether a user has finished
-- the post-signup profile setup flow.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE;

-- Existing users (created before this migration) are considered
-- already onboarded — they don't need the setup screen.
UPDATE profiles SET onboarding_complete = TRUE WHERE onboarding_complete = FALSE;
