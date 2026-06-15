-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 088: meeting-request notifications (H1)
--
-- Meeting requests previously surfaced only on /meetings (30s poll). Enqueue an
-- in-app notification so the recipient sees a new request and the requester sees
-- the accept/decline — mirroring the DM notification trigger (036). Web push is
-- sent client-side at the action points (matching application-status pushes).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.meeting_requests_enqueue_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_name TEXT;
  recipient_name TEXT;
  when_text TEXT;
BEGIN
  when_text := to_char(NEW.requested_date, 'Mon DD')
               || ' at ' || ltrim(to_char(NEW.requested_start_time, 'HH12:MI AM'));

  IF TG_OP = 'INSERT' THEN
    SELECT full_name INTO requester_name FROM public.profiles WHERE id = NEW.requester_id;
    INSERT INTO public.notifications (user_id, kind, source_id, link, title, subtitle)
    VALUES (NEW.recipient_id, 'meeting_request', NEW.id, '/meetings',
            'New meeting request from ' || COALESCE(requester_name, 'someone'),
            when_text);

  ELSIF TG_OP = 'UPDATE'
        AND NEW.status IS DISTINCT FROM OLD.status
        AND NEW.status IN ('accepted', 'declined') THEN
    SELECT full_name INTO recipient_name FROM public.profiles WHERE id = NEW.recipient_id;
    INSERT INTO public.notifications (user_id, kind, source_id, link, title, subtitle)
    VALUES (NEW.requester_id, 'meeting_response', NEW.id, '/meetings',
            'Meeting ' || NEW.status || ' by ' || COALESCE(recipient_name, 'someone'),
            when_text);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS meeting_requests_enqueue_notification ON public.meeting_requests;
CREATE TRIGGER meeting_requests_enqueue_notification
  AFTER INSERT OR UPDATE ON public.meeting_requests
  FOR EACH ROW EXECUTE FUNCTION public.meeting_requests_enqueue_notification();

NOTIFY pgrst, 'reload schema';
