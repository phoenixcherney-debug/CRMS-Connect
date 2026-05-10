-- 067_mentor_shortlist.sql
-- Phase 2.4 — mentor shortlist. A mentor can flag students they want to
-- follow up with, with an optional private 200-char note. Each row is
-- private to the mentor.

CREATE TABLE IF NOT EXISTS public.mentor_shortlist (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT mentor_shortlist_unique UNIQUE (mentor_id, student_id),
  CONSTRAINT mentor_shortlist_note_len CHECK (note IS NULL OR char_length(note) <= 200),
  CONSTRAINT mentor_shortlist_no_self CHECK (mentor_id <> student_id)
);

CREATE INDEX IF NOT EXISTS mentor_shortlist_mentor_idx
  ON public.mentor_shortlist (mentor_id, created_at DESC);

ALTER TABLE public.mentor_shortlist ENABLE ROW LEVEL SECURITY;

-- Only the mentor sees, inserts, updates, deletes their own entries.
DROP POLICY IF EXISTS mentor_shortlist_select_own ON public.mentor_shortlist;
CREATE POLICY mentor_shortlist_select_own
  ON public.mentor_shortlist FOR SELECT TO authenticated
  USING (auth.uid() = mentor_id);

DROP POLICY IF EXISTS mentor_shortlist_insert_own ON public.mentor_shortlist;
CREATE POLICY mentor_shortlist_insert_own
  ON public.mentor_shortlist FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = mentor_id);

DROP POLICY IF EXISTS mentor_shortlist_update_own ON public.mentor_shortlist;
CREATE POLICY mentor_shortlist_update_own
  ON public.mentor_shortlist FOR UPDATE TO authenticated
  USING (auth.uid() = mentor_id)
  WITH CHECK (auth.uid() = mentor_id);

DROP POLICY IF EXISTS mentor_shortlist_delete_own ON public.mentor_shortlist;
CREATE POLICY mentor_shortlist_delete_own
  ON public.mentor_shortlist FOR DELETE TO authenticated
  USING (auth.uid() = mentor_id);

-- Trigger: enforce roles (mentor must be employer_mentor, target must be student).
CREATE OR REPLACE FUNCTION public.mentor_shortlist_validate_roles_trg()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  m_role TEXT;
  s_role TEXT;
BEGIN
  SELECT role INTO m_role FROM public.profiles WHERE id = NEW.mentor_id;
  SELECT role INTO s_role FROM public.profiles WHERE id = NEW.student_id;
  IF m_role IS DISTINCT FROM 'employer_mentor' THEN
    RAISE EXCEPTION 'crms: only mentors can shortlist' USING ERRCODE = 'check_violation';
  END IF;
  IF s_role IS DISTINCT FROM 'student' THEN
    RAISE EXCEPTION 'crms: only students can be shortlisted' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mentor_shortlist_validate_roles ON public.mentor_shortlist;
CREATE TRIGGER mentor_shortlist_validate_roles
  BEFORE INSERT OR UPDATE OF mentor_id, student_id ON public.mentor_shortlist
  FOR EACH ROW EXECUTE FUNCTION public.mentor_shortlist_validate_roles_trg();
