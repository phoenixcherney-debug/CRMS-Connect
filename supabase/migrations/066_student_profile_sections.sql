-- 066_student_profile_sections.sql
-- Phase 2.1 — structured profile fields for students.
--
-- Stored on profiles directly so the existing RLS continues to apply.
-- Per-element validation lives in triggers since CHECK can't run
-- subqueries against unnest() output.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS skills TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS projects JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS links JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS default_resume_path TEXT;

-- Skills: ≤12 chips.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_skills_max12;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_skills_max12
    CHECK (array_length(skills, 1) IS NULL OR array_length(skills, 1) <= 12);

-- Projects: ≤4, JSONB array shape.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_projects_shape;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_projects_shape
    CHECK (
      jsonb_typeof(projects) = 'array'
      AND jsonb_array_length(projects) <= 4
    );

-- Links: object shape, no length cap (only 3 known keys).
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_links_shape;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_links_shape
    CHECK (jsonb_typeof(links) = 'object');

-- Default resume: PDF only by extension.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_default_resume_pdf;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_default_resume_pdf
    CHECK (default_resume_path IS NULL OR default_resume_path ~* '\.pdf$');

-- Per-element validation for skills + projects.
CREATE OR REPLACE FUNCTION public.profiles_validate_sections_trg()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  s TEXT;
  p JSONB;
  k TEXT;
BEGIN
  -- Skills: each ≤30 chars, non-blank.
  IF NEW.skills IS NOT NULL THEN
    FOREACH s IN ARRAY NEW.skills LOOP
      IF char_length(s) > 30 OR length(btrim(s)) = 0 THEN
        RAISE EXCEPTION 'crms: skill must be 1-30 chars' USING ERRCODE = 'check_violation';
      END IF;
    END LOOP;
  END IF;

  -- Projects: each must have a non-blank title ≤80; url if present must be http(s);
  -- description ≤200.
  IF NEW.projects IS NOT NULL AND jsonb_array_length(NEW.projects) > 0 THEN
    FOR p IN SELECT * FROM jsonb_array_elements(NEW.projects) LOOP
      IF coalesce(p->>'title', '') = '' OR char_length(p->>'title') > 80 THEN
        RAISE EXCEPTION 'crms: project title must be 1-80 chars' USING ERRCODE = 'check_violation';
      END IF;
      IF (p ? 'url') AND coalesce(p->>'url', '') <> '' AND (p->>'url') !~* '^https?://[^\s]+$' THEN
        RAISE EXCEPTION 'crms: project url must be http(s)' USING ERRCODE = 'check_violation';
      END IF;
      IF (p ? 'description') AND char_length(coalesce(p->>'description', '')) > 200 THEN
        RAISE EXCEPTION 'crms: project description ≤200 chars' USING ERRCODE = 'check_violation';
      END IF;
    END LOOP;
  END IF;

  -- Links: known keys only, each value http(s) when present.
  IF NEW.links IS NOT NULL AND jsonb_typeof(NEW.links) = 'object' THEN
    FOR k IN SELECT jsonb_object_keys(NEW.links) LOOP
      IF k NOT IN ('github', 'website', 'linkedin') THEN
        RAISE EXCEPTION 'crms: unknown link key %', k USING ERRCODE = 'check_violation';
      END IF;
      IF (NEW.links->>k) IS NOT NULL AND (NEW.links->>k) <> '' AND (NEW.links->>k) !~* '^https?://[^\s]+$' THEN
        RAISE EXCEPTION 'crms: link % must be http(s)', k USING ERRCODE = 'check_violation';
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_validate_sections ON public.profiles;
CREATE TRIGGER profiles_validate_sections
  BEFORE INSERT OR UPDATE OF skills, projects, links ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_validate_sections_trg();

-- Storage RLS for default_resume_path: same `resumes` bucket but a
-- different folder convention `resumes/profile/<user_id>/...`. The
-- policies from migration 063 only match `resumes/<application_id>/`,
-- so we need a parallel set for the profile path.
DROP POLICY IF EXISTS resumes_insert_own_profile ON storage.objects;
CREATE POLICY resumes_insert_own_profile
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'resumes'
    AND split_part(name, '/', 1) = 'profile'
    AND (split_part(name, '/', 2))::uuid = auth.uid()
  );

DROP POLICY IF EXISTS resumes_select_own_profile_or_accepted_poster ON storage.objects;
CREATE POLICY resumes_select_own_profile_or_accepted_poster
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'resumes'
    AND split_part(name, '/', 1) = 'profile'
    AND (
      public.is_admin()
      OR (split_part(name, '/', 2))::uuid = auth.uid()
      -- Posters can read a default resume only via an accepted application.
      OR EXISTS (
        SELECT 1 FROM public.applications a
         WHERE a.applicant_id = (split_part(name, '/', 2))::uuid
           AND a.status = 'accepted'
           AND auth.uid() = (SELECT posted_by FROM public.jobs WHERE id = a.job_id)
      )
    )
  );

DROP POLICY IF EXISTS resumes_update_own_profile ON storage.objects;
CREATE POLICY resumes_update_own_profile
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'resumes'
    AND split_part(name, '/', 1) = 'profile'
    AND (split_part(name, '/', 2))::uuid = auth.uid()
  );

DROP POLICY IF EXISTS resumes_delete_own_profile ON storage.objects;
CREATE POLICY resumes_delete_own_profile
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'resumes'
    AND split_part(name, '/', 1) = 'profile'
    AND (split_part(name, '/', 2))::uuid = auth.uid()
  );
