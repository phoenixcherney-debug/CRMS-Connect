-- 068_availability_timezone.sql
-- Phase 3.1 — store the mentor's IANA timezone alongside each
-- availability slot so a remote student in PT/ET sees the time in
-- their own zone and the mentor's. Default to America/Denver since
-- CRMS sits in Mountain Time; existing rows are backfilled to that.

ALTER TABLE public.availability_slots
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/Denver';

-- Length cap so we don't store junk; loose check on the slash-segment shape
-- (Area/Location). Postgres can't validate IANA values authoritatively without
-- a CLDR table, so this is a sniff test, not full validation.
ALTER TABLE public.availability_slots
  DROP CONSTRAINT IF EXISTS availability_slots_timezone_shape;
ALTER TABLE public.availability_slots
  ADD CONSTRAINT availability_slots_timezone_shape
    CHECK (char_length(timezone) BETWEEN 3 AND 64 AND timezone ~ '^[A-Za-z]+(/[A-Za-z_\-+0-9]+){0,2}$');
