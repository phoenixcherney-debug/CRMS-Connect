-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 024: Remove orphaned applicant_count trigger
--
-- Migration 008 added jobs.applicant_count plus a trigger to maintain it.
-- Migration 020 dropped the column but left the trigger in place. Every INSERT
-- on `applications` now fires the trigger, which UPDATE-s a column that no
-- longer exists, raising:
--   ERROR: column "applicant_count" does not exist
-- and aborting the application insert.
--
-- We compute applicant counts on the fly via `count(*) from applications` in
-- the UI, so the column and trigger are not needed.
-- ─────────────────────────────────────────────────────────────────────────────

DROP TRIGGER  IF EXISTS trigger_update_job_applicant_count ON public.applications;
DROP FUNCTION IF EXISTS public.update_job_applicant_count() CASCADE;
