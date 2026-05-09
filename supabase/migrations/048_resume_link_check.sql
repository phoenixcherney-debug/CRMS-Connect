-- 048_resume_link_check.sql
-- B.1 — defense-in-depth on the apply form's resume URL.
-- Client validates via validateExternalUrl(); server-side, RLS lets the
-- applicant insert their own row. Adding a CHECK so a hand-crafted REST
-- call can't write a `javascript:` URL into applications.resume_link.

ALTER TABLE public.applications
  ADD CONSTRAINT applications_resume_link_format
    CHECK (
      resume_link IS NULL
      OR resume_link ~* '^https?://[^\s]+$'
    );
