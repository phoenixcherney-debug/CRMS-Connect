-- Migration 017: Connection Request & Approval System Overhaul
-- 1. Add interests[] and weekly_availability to profiles (student screening fields)
-- 2. Add expected_weekly_hours to jobs
-- 3. Add 'waitlisted' value to application_status enum

-- Student screening fields on profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS interests text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS weekly_availability text;

-- Expected commitment field on job postings
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS expected_weekly_hours text;

-- Extend application_status enum (Postgres 12+ supports IF NOT EXISTS)
ALTER TYPE application_status ADD VALUE IF NOT EXISTS 'waitlisted';
