-- 031_share_grade_with_employers.sql
--
-- Audit M9 — privacy gating for student grade.
--
-- Default `share_grade_with_employers` to false so a student's grade level
-- doesn't leak to anyone outside their own profile until they opt in.
-- Renders that surface grade (People, Applicants, PublicProfile) check
-- this flag before showing the value.
--
-- The flag is stored on `profiles` even for non-students (cheaper than a
-- separate table) and is simply ignored when role != 'student'.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS share_grade_with_employers BOOLEAN
  NOT NULL DEFAULT FALSE;

-- Backfill: any existing profile keeps the default (false). No special
-- handling needed for existing rows since false is the privacy-respecting
-- default.

COMMENT ON COLUMN public.profiles.share_grade_with_employers IS
  'Student opt-in: when true, the student''s grade is shown on /people, /jobs/:id/applicants, and /people/:id to viewers other than themselves. Default false.';
