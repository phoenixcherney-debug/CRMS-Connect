-- 043_validate_role_on_update.sql
-- C-06 — close a hole in the role/email validation trigger.
--
-- Migration 022 added validate_profile_email_role() as a BEFORE INSERT
-- trigger on profiles. That blocks new student rows whose email isn't
-- @crms.org, but a user who signed up as employer_mentor (with a
-- personal email) could subsequently UPDATE their own profile row to
-- role='student' and bypass the domain check entirely (profiles_update
-- RLS allows owners to update their own row).
--
-- Fix: re-create the trigger to fire on UPDATE too. The function's
-- domain checks are unchanged; we just widen when they run.

DROP TRIGGER IF EXISTS validate_profile_before_insert ON public.profiles;

CREATE TRIGGER validate_profile_email_role_iud
  BEFORE INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.validate_profile_email_role();
