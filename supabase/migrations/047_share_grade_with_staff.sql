-- 047_share_grade_with_staff.sql
-- A.1 — privacy promise on /privacy says "School staff always see your
-- grade." Adding a separate share_grade_with_staff flag (defaults true)
-- so a future product call to let students hide grade from staff has a
-- column to hang off, without breaking the existing default.
--
-- The companion column share_grade_with_employers ships in 031.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS share_grade_with_staff BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.share_grade_with_staff IS
  'When true (default), school staff (admins) can see this user grade. When false, even admins are blind. Provided so the privacy doc copy can stay accurate as the product evolves.';
