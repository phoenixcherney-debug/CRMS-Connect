-- 078_resume_docx.sql
-- Task 22 — accept DOCX resumes alongside PDF. Two things to relax:
--   1. the `applications.resume_path` CHECK regex
--   2. the storage bucket's allowed_mime_types

ALTER TABLE public.applications
  DROP CONSTRAINT IF EXISTS applications_resume_path_pdf;
ALTER TABLE public.applications
  ADD CONSTRAINT applications_resume_path_pdf
    CHECK (resume_path IS NULL OR resume_path ~* '\.(pdf|docx)$');

-- Mirror constraint on profiles.default_resume_path so a student can
-- upload a DOCX default resume too.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_default_resume_pdf;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_default_resume_pdf
    CHECK (default_resume_path IS NULL OR default_resume_path ~* '\.(pdf|docx)$');

UPDATE storage.buckets
   SET allowed_mime_types = ARRAY[
     'application/pdf',
     'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
   ]
 WHERE id = 'resumes';
