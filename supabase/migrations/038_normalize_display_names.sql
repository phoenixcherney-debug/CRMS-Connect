-- 038_normalize_display_names.sql
--
-- P2-20 — title-case any profile.full_name that was stored entirely in
-- lowercase. Preserves names with any uppercase letter (so "DJ Smith",
-- "iOS Joe", "Mary-Anne O'Brien" stay as the user typed them) — only
-- the all-lowercase rows ("sam student", "claude employer account") get
-- normalized.
--
-- New signups go through formatDisplayName() in the client now, so this
-- backfill is a one-time pass for legacy rows.

UPDATE public.profiles
SET full_name = initcap(full_name)
WHERE full_name = lower(full_name)
  AND length(full_name) > 0;
