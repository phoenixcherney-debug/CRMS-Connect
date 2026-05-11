-- 075_mentor_consent_confirmed_at.sql
-- Task 3 — track when the mentor last confirmed their visibility. Used
-- to show a yearly reconfirmation prompt; on dismissal we flip
-- open_to_mentorship back to FALSE.
--
-- Backfilled: any existing mentor with open_to_mentorship=TRUE gets
-- their current created_at as the baseline timestamp, so the yearly
-- prompt fires sometime in the next 12 months rather than immediately
-- for everyone.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mentor_consent_confirmed_at TIMESTAMPTZ;

UPDATE public.profiles
   SET mentor_consent_confirmed_at = created_at
 WHERE role = 'employer_mentor'
   AND open_to_mentorship = TRUE
   AND mentor_consent_confirmed_at IS NULL;

-- Auto-stamp on toggle-on. Don't clear on toggle-off — we want to
-- remember the most recent affirmative consent for audit even after
-- the user un-toggles.
CREATE OR REPLACE FUNCTION public.profiles_mentor_consent_stamp_trg()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.open_to_mentorship = TRUE
     AND (TG_OP = 'INSERT' OR OLD.open_to_mentorship IS DISTINCT FROM TRUE)
  THEN
    NEW.mentor_consent_confirmed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_mentor_consent_stamp ON public.profiles;
CREATE TRIGGER profiles_mentor_consent_stamp
  BEFORE INSERT OR UPDATE OF open_to_mentorship ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_mentor_consent_stamp_trg();
