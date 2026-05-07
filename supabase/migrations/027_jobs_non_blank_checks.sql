-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 027: Non-blank CHECK constraints on jobs core fields
--
-- Audit pass 4 §1: client-side `required` + `noValidate` produced jobs with
-- empty `company` and `location`. The frontend now trims and rejects, but a
-- defense-in-depth CHECK at the DB layer ensures any future code path can't
-- regress this. Applied AFTER scrubbing existing rows so the constraint
-- doesn't reject existing data.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Step 1: scrub existing offending rows (deactivate them rather than
--           silently mutating user-authored content). A poster can revive
--           the row by editing in the new validating form.
UPDATE public.jobs
SET is_active = false
WHERE char_length(trim(coalesce(title,       ''))) = 0
   OR char_length(trim(coalesce(company,     ''))) = 0
   OR char_length(trim(coalesce(location,    ''))) = 0
   OR char_length(trim(coalesce(description, ''))) = 0;

-- Backfill placeholders so the row passes the constraint. The is_active=false
-- above keeps them out of the listing, and editors can replace the placeholder.
UPDATE public.jobs
SET title       = COALESCE(NULLIF(trim(title),       ''), '(untitled)')
  , company     = COALESCE(NULLIF(trim(company),     ''), '(unspecified)')
  , location    = COALESCE(NULLIF(trim(location),    ''), '(unspecified)')
  , description = COALESCE(NULLIF(trim(description), ''), '(no description)')
WHERE char_length(trim(coalesce(title,       ''))) = 0
   OR char_length(trim(coalesce(company,     ''))) = 0
   OR char_length(trim(coalesce(location,    ''))) = 0
   OR char_length(trim(coalesce(description, ''))) = 0;

-- ── Step 2: apply the constraints.
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_title_not_blank;
ALTER TABLE public.jobs ADD  CONSTRAINT jobs_title_not_blank
  CHECK (char_length(trim(title)) > 0);

ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_company_not_blank;
ALTER TABLE public.jobs ADD  CONSTRAINT jobs_company_not_blank
  CHECK (char_length(trim(company)) > 0);

ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_location_not_blank;
ALTER TABLE public.jobs ADD  CONSTRAINT jobs_location_not_blank
  CHECK (char_length(trim(location)) > 0);

ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_description_not_blank;
ALTER TABLE public.jobs ADD  CONSTRAINT jobs_description_not_blank
  CHECK (char_length(trim(description)) > 0);
