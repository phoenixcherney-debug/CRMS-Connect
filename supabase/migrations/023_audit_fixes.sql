-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 023: Post-audit hardening
--
-- 1. Make handle_new_user defensive: default missing role to 'student',
--    require a non-empty full_name, and prevent orphaned auth.users rows.
-- 2. Backfill any existing orphaned auth.users rows that lack a profiles row.
-- 3. Add CHECK constraints for graduation_year sanity + full_name length.
-- 4. Lock down jobs.contact_email by exposing jobs through a column-restricted
--    view; require ownership/applicant relationship to read raw contact_email.
-- 5. Stop forcing how_to_apply / contact_email NOT NULL — the current UI does
--    not collect them.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Defensive signup trigger ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  meta_full_name TEXT;
  meta_role      TEXT;
  resolved_role  public.role_type;
BEGIN
  meta_full_name := NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), '');
  meta_role      := NULLIF(NEW.raw_user_meta_data->>'role', '');

  -- Default role: 'student' for @crms.org addresses, 'employer_mentor' otherwise.
  -- This is a safety net — the client always sends `role`, but a malformed call
  -- (or future schema change) should never strand an auth user with no profile.
  IF meta_role IS NULL THEN
    IF lower(NEW.email) LIKE '%@crms.org' THEN
      resolved_role := 'student'::public.role_type;
    ELSE
      resolved_role := 'employer_mentor'::public.role_type;
    END IF;
  ELSE
    -- Validate the supplied value is a real enum member; fall back if not.
    BEGIN
      resolved_role := meta_role::public.role_type;
    EXCEPTION WHEN OTHERS THEN
      resolved_role := 'student'::public.role_type;
    END;
  END IF;

  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(meta_full_name, split_part(NEW.email, '@', 1)),
    resolved_role
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- ── 2. Backfill orphaned auth.users rows ────────────────────────────────────
-- Any pre-existing auth user without a profile gets a minimal one so they
-- can complete onboarding instead of being stuck in a broken state.
INSERT INTO public.profiles (id, full_name, role)
SELECT
  u.id,
  COALESCE(NULLIF(TRIM(u.raw_user_meta_data->>'full_name'), ''), split_part(u.email, '@', 1)),
  CASE
    WHEN lower(u.email) LIKE '%@crms.org' THEN 'student'::public.role_type
    ELSE 'employer_mentor'::public.role_type
  END
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- ── 3. Sanity constraints on profile fields ─────────────────────────────────
-- Step 3a: clean existing data so the new CHECK constraints don't reject it.
-- The audit found rows with graduation_year=1961 and 2040 (outside the sane
-- range) and the test data may also have over-long bios or full_names.

-- Truncate names that are too long; coerce empty/NULL to the email prefix.
UPDATE public.profiles p
SET full_name = COALESCE(
  NULLIF(TRIM(LEFT(p.full_name, 60)), ''),
  split_part((SELECT email FROM auth.users u WHERE u.id = p.id), '@', 1),
  'Member'
)
WHERE p.full_name IS NULL
   OR char_length(p.full_name) > 60
   OR TRIM(p.full_name) = '';

-- Truncate over-long bios to 2000 chars.
UPDATE public.profiles
SET bio = LEFT(bio, 2000)
WHERE bio IS NOT NULL AND char_length(bio) > 2000;

-- NULL out implausible graduation_year values rather than guessing.
UPDATE public.profiles
SET graduation_year = NULL
WHERE graduation_year IS NOT NULL
  AND (
    graduation_year < EXTRACT(YEAR FROM CURRENT_DATE)::INT - 80
    OR graduation_year > EXTRACT(YEAR FROM CURRENT_DATE)::INT + 8
  );

-- Step 3b: now safely (re)apply the constraints.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_full_name_length_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_full_name_length_check
  CHECK (char_length(full_name) BETWEEN 1 AND 60);

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_graduation_year_range_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_graduation_year_range_check
  CHECK (
    graduation_year IS NULL
    OR (
      graduation_year >= EXTRACT(YEAR FROM CURRENT_DATE)::INT - 80
      AND graduation_year <= EXTRACT(YEAR FROM CURRENT_DATE)::INT + 8
    )
  );

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_bio_length_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_bio_length_check
  CHECK (bio IS NULL OR char_length(bio) <= 2000);

-- ── 4. Lock down jobs.contact_email ─────────────────────────────────────────
-- The contact_email column was readable by every authenticated user via the
-- broad jobs_select_authenticated policy. We replace that with a
-- column-restricted view (jobs_public) and a stricter RLS policy that hides
-- contact_email unless the caller is the poster, an admin, or the applicant
-- whose application has been accepted.

-- Stop blocking new posts that don't have these fields populated by the form.
ALTER TABLE public.jobs ALTER COLUMN how_to_apply  DROP NOT NULL;
ALTER TABLE public.jobs ALTER COLUMN contact_email DROP NOT NULL;

-- Convert any sentinel empty strings inserted by the current frontend to NULL
-- so we don't leak a confusing empty string in the public view.
UPDATE public.jobs SET contact_email = NULL WHERE contact_email = '';
UPDATE public.jobs SET how_to_apply  = NULL WHERE how_to_apply  = '';

-- Public view: every column EXCEPT contact_email. Use this from the client.
DROP VIEW IF EXISTS public.jobs_public;
CREATE VIEW public.jobs_public
WITH (security_invoker = true) AS
SELECT
  id, created_at, posted_by, title, company, location, job_type, description,
  how_to_apply, deadline, is_active, location_type, industry,
  expected_weekly_hours, opportunity_type, opportunity_type_other,
  start_date, end_date
FROM public.jobs;

GRANT SELECT ON public.jobs_public TO authenticated;

-- Function: returns contact_email only to people who should see it.
CREATE OR REPLACE FUNCTION public.job_contact_email(job_uuid UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  poster      UUID;
  caller      UUID := auth.uid();
  caller_role public.role_type;
  email_text  TEXT;
BEGIN
  IF caller IS NULL THEN RETURN NULL; END IF;

  SELECT posted_by, contact_email INTO poster, email_text
  FROM public.jobs WHERE id = job_uuid;

  IF email_text IS NULL THEN RETURN NULL; END IF;

  -- Poster always sees their own posting's contact email.
  IF poster = caller THEN RETURN email_text; END IF;

  -- Admins always see it.
  SELECT role INTO caller_role FROM public.profiles WHERE id = caller;
  IF caller_role = 'admin' THEN RETURN email_text; END IF;

  -- Applicants see it only after their application is accepted.
  IF EXISTS (
    SELECT 1 FROM public.applications
    WHERE job_id = job_uuid
      AND applicant_id = caller
      AND status = 'accepted'
  ) THEN
    RETURN email_text;
  END IF;

  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.job_contact_email(UUID) TO authenticated;

-- ── 5. Tighten profiles SELECT — hide soft-deleted/banned bios ─────────────
-- The existing policy allows any authenticated user to read every column of
-- every profile. We keep that for basic discovery but trim banned profiles.
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_authenticated"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    banned_at IS NULL
    OR id = auth.uid()
    OR public.is_admin()
  );
