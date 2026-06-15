-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 090: in-app event RSVP (K1)
--
-- events.capacity was decorative and registration was an external link only.
-- Add real RSVP tracking with server-side capacity enforcement. Attendee
-- identities aren't exposed to other users — seats-remaining comes from a
-- SECURITY DEFINER count function; each user only sees their own RSVP rows.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.event_rsvps (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid NOT NULL REFERENCES public.events(id)   ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_event_rsvps_event_id ON public.event_rsvps(event_id);
CREATE INDEX IF NOT EXISTS idx_event_rsvps_user_id  ON public.event_rsvps(user_id);

ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_rsvps_select_own ON public.event_rsvps;
CREATE POLICY event_rsvps_select_own ON public.event_rsvps
  FOR SELECT USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS event_rsvps_insert_own ON public.event_rsvps;
CREATE POLICY event_rsvps_insert_own ON public.event_rsvps
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS event_rsvps_delete_own ON public.event_rsvps;
CREATE POLICY event_rsvps_delete_own ON public.event_rsvps
  FOR DELETE USING (user_id = (SELECT auth.uid()));

-- Per-event attendee counts, without exposing who's attending.
CREATE OR REPLACE FUNCTION public.event_rsvp_counts()
RETURNS TABLE(event_id uuid, attendee_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT event_id, count(*)::bigint FROM public.event_rsvps GROUP BY event_id;
$$;
REVOKE EXECUTE ON FUNCTION public.event_rsvp_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.event_rsvp_counts() TO authenticated;

-- Server-side capacity enforcement (defends against the race the UI can't).
CREATE OR REPLACE FUNCTION public.event_rsvps_enforce_capacity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  cap int;
  cnt int;
BEGIN
  SELECT capacity INTO cap FROM public.events WHERE id = NEW.event_id;
  IF cap IS NOT NULL THEN
    SELECT count(*) INTO cnt FROM public.event_rsvps WHERE event_id = NEW.event_id;
    IF cnt >= cap THEN
      RAISE EXCEPTION 'crms: this event is full' USING ERRCODE = 'check_violation', HINT = 'event_full';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS event_rsvps_enforce_capacity ON public.event_rsvps;
CREATE TRIGGER event_rsvps_enforce_capacity
  BEFORE INSERT ON public.event_rsvps
  FOR EACH ROW EXECUTE FUNCTION public.event_rsvps_enforce_capacity();

NOTIFY pgrst, 'reload schema';
