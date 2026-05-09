-- 041_events_richer_fields.sql
-- P3-48 / P3-49 — richer event fields.
--
-- Adds:
--   • all_day            BOOLEAN — when true, time fields are null and the
--                         event renders as "All day".
--   • end_time           TEXT    — optional end of event (HH:MM 24h).
--   • registration_link  TEXT    — optional external RSVP URL.
--   • capacity           INTEGER — optional headcount cap (for surfacing).
--
-- All new columns are NULL-allowed so existing rows are valid as-is.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS all_day            BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS end_time           TEXT,
  ADD COLUMN IF NOT EXISTS registration_link  TEXT,
  ADD COLUMN IF NOT EXISTS capacity           INTEGER;

-- Back-fill: existing rows that lack a start time pre-date this migration —
-- treat them as all-day so the time-consistency constraint below is valid.
UPDATE events
   SET all_day = true
 WHERE time IS NULL
   AND all_day = false;

-- Light bounds — capacity must be positive, link must look like a URL.
ALTER TABLE events
  ADD CONSTRAINT events_capacity_positive
    CHECK (capacity IS NULL OR capacity > 0);

ALTER TABLE events
  ADD CONSTRAINT events_registration_link_format
    CHECK (
      registration_link IS NULL
      OR registration_link ~* '^https?://[^\s]+$'
    );

-- When all_day is true the time columns must be null. When false, `time`
-- (start) is required (the UI enforces this; the DB belt-and-suspenders).
ALTER TABLE events
  ADD CONSTRAINT events_time_consistency
    CHECK (
      (all_day = true  AND time IS NULL AND end_time IS NULL)
      OR
      (all_day = false AND time IS NOT NULL)
    );
