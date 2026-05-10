-- 062_jobs_draft.sql
-- P1-4 — drafts. Posters can save an in-progress opportunity without
-- triggering the not-blank CHECKs that gate a real publish.
--
-- Strategy: add `is_draft` and rewrite the four not-blank constraints
-- so they only apply when the row isn't a draft. Drafts also stay
-- is_active = false so they don't show in any directory query that
-- already filters on it.

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS is_draft BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.jobs
  DROP CONSTRAINT IF EXISTS jobs_title_not_blank;
ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_title_not_blank
    CHECK (is_draft OR length(btrim(title)) > 0);

ALTER TABLE public.jobs
  DROP CONSTRAINT IF EXISTS jobs_company_not_blank;
ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_company_not_blank
    CHECK (is_draft OR length(btrim(company)) > 0);

ALTER TABLE public.jobs
  DROP CONSTRAINT IF EXISTS jobs_location_not_blank;
ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_location_not_blank
    CHECK (is_draft OR length(btrim(location)) > 0);

ALTER TABLE public.jobs
  DROP CONSTRAINT IF EXISTS jobs_description_not_blank;
ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_description_not_blank
    CHECK (is_draft OR length(btrim(description)) > 0);

-- Drafts shouldn't ever surface to students. Index the predicate so
-- the existing `is_active=true` filter is index-friendly when this
-- column is also taken into account.
CREATE INDEX IF NOT EXISTS idx_jobs_active_non_draft
  ON public.jobs (created_at DESC)
  WHERE is_active = TRUE AND is_draft = FALSE;
