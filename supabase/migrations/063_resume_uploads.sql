-- 063_resume_uploads.sql
-- P1-8 — let applicants attach a PDF resume to their application.
-- Stored in a private `resumes` bucket; access gated by storage RLS so
-- only the applicant + the poster of an *accepted* application can
-- read.
--
-- Path scheme:  resumes/<application_id>/<original_filename>.pdf
-- (We don't trust the original filename for anything other than display.)

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS resume_path TEXT;

ALTER TABLE public.applications
  DROP CONSTRAINT IF EXISTS applications_resume_path_pdf;
ALTER TABLE public.applications
  ADD CONSTRAINT applications_resume_path_pdf
    CHECK (resume_path IS NULL OR resume_path ~* '\.pdf$');

-- Create the bucket if it doesn't exist. Private (public=false), 5 MB cap,
-- only application/pdf MIME type.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'resumes', 'resumes', FALSE, 5 * 1024 * 1024,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS. Path prefix is `resumes/<application_id>/...` so we can
-- pull the application id out of the object name.
DROP POLICY IF EXISTS resumes_insert_own_application ON storage.objects;
CREATE POLICY resumes_insert_own_application
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'resumes'
    AND EXISTS (
      SELECT 1 FROM public.applications a
       WHERE a.id = (split_part(name, '/', 2))::uuid
         AND a.applicant_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS resumes_select_applicant_or_accepted_poster ON storage.objects;
CREATE POLICY resumes_select_applicant_or_accepted_poster
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'resumes'
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.applications a
         WHERE a.id = (split_part(name, '/', 2))::uuid
           AND (
             a.applicant_id = auth.uid()
             OR (
               a.status = 'accepted'
               AND auth.uid() = (SELECT posted_by FROM public.jobs WHERE id = a.job_id)
             )
           )
      )
    )
  );

-- Owners can replace their own resume.
DROP POLICY IF EXISTS resumes_update_own ON storage.objects;
CREATE POLICY resumes_update_own
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'resumes'
    AND EXISTS (
      SELECT 1 FROM public.applications a
       WHERE a.id = (split_part(name, '/', 2))::uuid
         AND a.applicant_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS resumes_delete_own ON storage.objects;
CREATE POLICY resumes_delete_own
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'resumes'
    AND EXISTS (
      SELECT 1 FROM public.applications a
       WHERE a.id = (split_part(name, '/', 2))::uuid
         AND a.applicant_id = auth.uid()
    )
  );
