-- 036_notifications.sql
--
-- NAV-005 — explicit notifications table so DMs surface as
-- notifications instead of vanishing the moment the recipient opens
-- the thread. (The previous Notifications page derived rows from a
-- live messages query filtered by is_read=false, so once sam opened
-- chill's thread, the DM disappeared from /notifications.)
--
-- Schema is generic enough to also hold application-status events,
-- meeting-request events, etc. — but for this commit only DMs are
-- wired in. The existing Notifications page keeps deriving the other
-- kinds from their source tables; this table lives alongside.

CREATE TYPE public.notification_kind_t AS ENUM (
  'dm_received',
  'application_status',
  'meeting_request',
  'meeting_response'
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind        public.notification_kind_t NOT NULL,
  /** Free-form pointer to the source row (message id, application id, …). */
  source_id   UUID,
  /** Deep link the bell should open. */
  link        TEXT NOT NULL,
  title       TEXT NOT NULL,
  subtitle    TEXT,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications(user_id, read_at, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- A user only sees / updates their own notifications.
DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
CREATE POLICY notifications_select_own ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS notifications_update_own ON public.notifications;
CREATE POLICY notifications_update_own ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());

-- Inserts come from the trigger below, which runs as the privileged
-- definer (the trigger needs to write to a row owned by the recipient,
-- not the sender).
DROP POLICY IF EXISTS notifications_insert_definer ON public.notifications;
CREATE POLICY notifications_insert_definer ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL OR true);

-- Trigger: every new message → enqueue a notification for the recipient.
CREATE OR REPLACE FUNCTION public.messages_enqueue_dm_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient UUID;
  sender_name TEXT;
BEGIN
  -- Determine the recipient: whichever conversation participant is not the
  -- sender.
  SELECT CASE WHEN c.participant_one = NEW.sender_id
              THEN c.participant_two
              ELSE c.participant_one
         END
    INTO recipient
    FROM public.conversations c
   WHERE c.id = NEW.conversation_id;

  IF recipient IS NULL OR recipient = NEW.sender_id THEN RETURN NEW; END IF;

  SELECT full_name INTO sender_name
    FROM public.profiles WHERE id = NEW.sender_id;

  INSERT INTO public.notifications (user_id, kind, source_id, link, title, subtitle)
  VALUES (
    recipient,
    'dm_received',
    NEW.id,
    '/messages/' || NEW.conversation_id::text,
    'New message from ' || COALESCE(sender_name, 'someone'),
    CASE WHEN length(NEW.content) > 100
         THEN substr(NEW.content, 1, 100) || '…'
         ELSE NEW.content
    END
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_enqueue_dm_notification ON public.messages;
CREATE TRIGGER messages_enqueue_dm_notification
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.messages_enqueue_dm_notification();
