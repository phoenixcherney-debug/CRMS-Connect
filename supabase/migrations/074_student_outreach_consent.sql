-- 074_student_outreach_consent.sql
-- Task 2 — gate adult → student first contact behind student consent.
--
-- A first message from an employer/mentor to a student is blocked
-- unless the student has explicitly toggled student_outreach_consent
-- on. Existing threads (where the student wrote first, or any thread
-- already in flight) are not affected — only the *new* relationship is
-- gated.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS student_outreach_consent BOOLEAN NOT NULL DEFAULT FALSE;

-- Trigger on messages: reject the insert if it's an employer/mentor's
-- first message to a non-consenting student.
CREATE OR REPLACE FUNCTION public.messages_check_outreach_consent_trg()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sender_role   public.role_type;
  conv_p1       UUID;
  conv_p2       UUID;
  other_id      UUID;
  other_role    public.role_type;
  other_consent BOOLEAN;
  prior_msg_count BIGINT;
BEGIN
  SELECT role INTO sender_role FROM public.profiles WHERE id = NEW.sender_id;
  IF sender_role IS DISTINCT FROM 'employer_mentor' THEN
    RETURN NEW; -- only adults need this gate
  END IF;

  SELECT participant_one, participant_two
    INTO conv_p1, conv_p2
    FROM public.conversations WHERE id = NEW.conversation_id;

  IF conv_p1 IS NULL THEN
    RAISE EXCEPTION 'crms: conversation not found' USING ERRCODE = 'foreign_key_violation';
  END IF;

  other_id := CASE WHEN conv_p1 = NEW.sender_id THEN conv_p2 ELSE conv_p1 END;
  SELECT role, student_outreach_consent
    INTO other_role, other_consent
    FROM public.profiles WHERE id = other_id;

  IF other_role IS DISTINCT FROM 'student' THEN
    RETURN NEW; -- only student recipients are gated
  END IF;

  -- Has the student ever written in this thread? If so, the student has
  -- effectively opted into outreach for this relationship.
  SELECT count(*) INTO prior_msg_count
    FROM public.messages m
   WHERE m.conversation_id = NEW.conversation_id
     AND m.sender_id = other_id;

  IF prior_msg_count > 0 THEN
    RETURN NEW;
  END IF;

  -- First-touch by an adult to a student. Require explicit consent.
  IF NOT coalesce(other_consent, FALSE) THEN
    RAISE EXCEPTION 'crms: student is not accepting outreach'
      USING ERRCODE = 'check_violation', HINT = 'no_outreach_consent';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_check_outreach_consent ON public.messages;
CREATE TRIGGER messages_check_outreach_consent
  BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.messages_check_outreach_consent_trg();

-- Same gate on conversations: an E/M inserting a new conversation
-- with a non-consenting student is blocked. Stops "create empty thread"
-- pre-stage from being used to bypass the messages trigger.
CREATE OR REPLACE FUNCTION public.conversations_check_outreach_consent_trg()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  initiator_role   public.role_type;
  target_role      public.role_type;
  target_consent   BOOLEAN;
  initiator_id     UUID;
  target_id        UUID;
BEGIN
  -- Determine the creator. Conversations are inserted by the authenticated
  -- user via RLS, so auth.uid() is the initiator.
  initiator_id := auth.uid();
  IF initiator_id IS NULL THEN RETURN NEW; END IF;

  SELECT role INTO initiator_role FROM public.profiles WHERE id = initiator_id;
  IF initiator_role IS DISTINCT FROM 'employer_mentor' THEN RETURN NEW; END IF;

  target_id := CASE WHEN NEW.participant_one = initiator_id THEN NEW.participant_two ELSE NEW.participant_one END;

  SELECT role, student_outreach_consent
    INTO target_role, target_consent
    FROM public.profiles WHERE id = target_id;

  IF target_role IS DISTINCT FROM 'student' THEN RETURN NEW; END IF;

  IF NOT coalesce(target_consent, FALSE) THEN
    RAISE EXCEPTION 'crms: student is not accepting outreach'
      USING ERRCODE = 'check_violation', HINT = 'no_outreach_consent';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS conversations_check_outreach_consent ON public.conversations;
CREATE TRIGGER conversations_check_outreach_consent
  BEFORE INSERT ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.conversations_check_outreach_consent_trg();
