-- 079_preferred_name.sql
-- Task 24 — preferred_name for greetings, byline labels, and avatar
-- tooltips. Optional; falls back to the first whitespace token of
-- full_name when null (client-side helper firstNameOf).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_name TEXT;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_preferred_name_len;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_preferred_name_len
    CHECK (preferred_name IS NULL OR (char_length(preferred_name) BETWEEN 1 AND 40));
