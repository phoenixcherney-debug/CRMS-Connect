-- 037_block_same_role_dms.sql
--
-- P0-1 — students should not be able to start DM threads with other
-- students; mentors should not start DMs with other mentors. The product
-- copy in /privacy and the New-Conversation modal already says so. This
-- migration enforces it at the DB level so a hand-crafted insert can't
-- bypass the UI.
--
-- Strategy: a BEFORE INSERT trigger on conversations that blocks rows
-- where both participants share the same `role`. Admins are still
-- allowed in either direction. The conversation-create write paths in
-- the client already short-circuit too (separate commit).
--
-- Note: this complements (does NOT replace) the same-role privacy guard
-- in PublicProfile — that guard is for *viewing* profiles, this is for
-- *initiating* a conversation.

CREATE OR REPLACE FUNCTION public.conversations_block_same_role_trg()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  role_one public.profiles.role%TYPE;
  role_two public.profiles.role%TYPE;
BEGIN
  SELECT role INTO role_one FROM public.profiles WHERE id = NEW.participant_one;
  SELECT role INTO role_two FROM public.profiles WHERE id = NEW.participant_two;

  -- Admin endpoints can route around this if both roles are admin (admins
  -- talking to themselves is a no-op the trigger doesn't need to catch).
  IF role_one IS NULL OR role_two IS NULL THEN
    RETURN NEW;
  END IF;
  IF role_one = 'admin' OR role_two = 'admin' THEN
    RETURN NEW;
  END IF;

  IF role_one = role_two THEN
    RAISE EXCEPTION 'crms: same-role conversations are not allowed (% ↔ %)', role_one, role_two
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS conversations_block_same_role ON public.conversations;
CREATE TRIGGER conversations_block_same_role
  BEFORE INSERT ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.conversations_block_same_role_trg();
