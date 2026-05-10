-- 053_applicant_notes.sql
-- P2-17 — private per-applicant notes for the employer.
--
-- One row per (job, applicant) so notes survive across status changes.
-- RLS keeps notes visible only to the job's poster (and admins).

CREATE TABLE IF NOT EXISTS public.applicant_notes (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id        UUID         NOT NULL REFERENCES public.jobs(id)     ON DELETE CASCADE,
  applicant_id  UUID         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_id     UUID         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body          TEXT         NOT NULL CHECK (char_length(body) <= 4000),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (job_id, applicant_id, author_id)
);

CREATE INDEX IF NOT EXISTS idx_applicant_notes_job ON public.applicant_notes (job_id, applicant_id);

ALTER TABLE public.applicant_notes ENABLE ROW LEVEL SECURITY;

-- Only the job poster (or an admin) can see / write notes for that job.
DROP POLICY IF EXISTS applicant_notes_select_owner_or_admin ON public.applicant_notes;
CREATE POLICY applicant_notes_select_owner_or_admin
  ON public.applicant_notes FOR SELECT
  USING (
    public.is_admin()
    OR auth.uid() = (SELECT posted_by FROM public.jobs WHERE id = job_id)
  );

DROP POLICY IF EXISTS applicant_notes_insert_owner ON public.applicant_notes;
CREATE POLICY applicant_notes_insert_owner
  ON public.applicant_notes FOR INSERT
  WITH CHECK (
    auth.uid() = author_id
    AND auth.uid() = (SELECT posted_by FROM public.jobs WHERE id = job_id)
  );

DROP POLICY IF EXISTS applicant_notes_update_owner ON public.applicant_notes;
CREATE POLICY applicant_notes_update_owner
  ON public.applicant_notes FOR UPDATE
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS applicant_notes_delete_owner ON public.applicant_notes;
CREATE POLICY applicant_notes_delete_owner
  ON public.applicant_notes FOR DELETE
  USING (auth.uid() = author_id);
