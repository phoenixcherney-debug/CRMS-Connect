-- 061_mentorship_pause.sql
-- P1-10 — let mentors pause their visibility with an auto-resume date.
-- A nightly job (or a check on directory read) reads
-- mentorship_paused_until and treats `open_to_mentorship && (paused_until
-- IS NULL OR paused_until <= now())` as the visibility predicate.
--
-- For the MVP we keep the column but evaluate "paused?" client-side on
-- the directory page. A scheduled cleanup that auto-clears expired
-- pauses can land later; for now an expired pause is just no-op.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mentorship_paused_until DATE;
