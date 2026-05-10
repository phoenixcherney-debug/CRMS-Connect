-- 064_notification_preferences.sql
-- P1-12 — per-user toggles for push notification categories. JSONB so
-- new event types can land without a migration; missing keys default to
-- "send" so nobody silently drops messages because we added a category
-- they never saw.
--
-- Known categories (read by the send-push edge function):
--   message            — new DM
--   application_in     — someone applied to my opportunity
--   application_status — my application's status changed
--   meeting_request    — incoming meeting request
--   student_post_match — new student post matching my industry

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_preferences JSONB
    NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_notification_preferences_shape;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_notification_preferences_shape
    CHECK (jsonb_typeof(notification_preferences) = 'object');
