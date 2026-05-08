-- cleanup-test-and-inappropriate-data.sql
--
-- Audit task 35 — one-off cleanup of duplicate / inappropriate / test
-- accounts and the rows attached to them.
--
-- HOW TO RUN:
--   1. Open a Supabase SQL editor connected to the target project (almost
--      certainly NOT production on the first run; preview the SELECT
--      output before applying the DELETEs).
--   2. Run the SELECT block first to confirm the matched ids are right.
--   3. Run the DELETE block.
--
-- The trigger from migration 032 strips HTML on subsequent UPDATE/INSERT
-- but doesn't help with rows that should be hard-deleted; that's this
-- script's job.
--
-- Re-attribution: profiles can't safely be hard-deleted because they're
-- referenced by FK from many tables (jobs.posted_by, applications.applicant_id,
-- conversations.participant_*, messages.sender_id, etc). Instead we soft-
-- delete by setting banned_at = now() and anonymizing personal fields, then
-- delete the offending content rows. Existing privacy policy already hides
-- banned profiles from the directory (RLS migration 030).
--
-- IMPORTANT:
--   - Wrap the apply step in a transaction so you can ROLLBACK if the
--     output looks wrong.
--   - Replace the placeholder identifiers below with the real ids from the
--     PREVIEW step. Don't trust regex matches blindly.

-- ─── PREVIEW ───────────────────────────────────────────────────────────────
-- Identify candidate profiles by name patterns the audit flagged.
SELECT id, full_name, role, created_at
FROM public.profiles
WHERE
     full_name ILIKE 'pheonix likes%'      -- derogatory display name
  OR full_name ILIKE 'nick cherney%'        -- audit-flagged seed
  OR full_name ILIKE 'alex tester%'         -- test account
  OR full_name ILIKE 'claude student%'      -- test account
  OR (full_name ILIKE 'phoenix cherney%' AND id NOT IN (
        -- Keep the canonical one. Replace this id with the real keeper.
        SELECT id FROM public.profiles
         WHERE full_name ILIKE 'phoenix cherney%'
         ORDER BY created_at ASC LIMIT 1
     ))
  OR (full_name ILIKE 'sam student%' AND id NOT IN (
        SELECT id FROM public.profiles
         WHERE full_name ILIKE 'sam student%'
         ORDER BY created_at ASC LIMIT 1
     ));

-- Identify candidate jobs by title / company strings the audit flagged.
SELECT id, title, company, posted_by, created_at
FROM public.jobs
WHERE
     title   ILIKE 'p. diddy oil chambers%'
  OR title   ILIKE 'dich digger%'
  OR title   ILIKE 'screening test%'
  OR title   ILIKE 'destroy stuff%'
  OR company ILIKE 'cherney wage%'
  OR company ILIKE 'big testing%'
  OR company ILIKE '%testies%';

-- ─── APPLY ─────────────────────────────────────────────────────────────────
-- Run the block below only after confirming the preview output.

BEGIN;

-- Anonymize + ban offending profiles. Existing RLS hides banned profiles.
UPDATE public.profiles
SET full_name              = 'Deleted user',
    avatar_url             = NULL,
    bio                    = NULL,
    company                = NULL,
    industry               = NULL,
    interests              = ARRAY[]::text[],
    weekly_availability    = NULL,
    mentor_type            = NULL,
    mentor_type_other      = NULL,
    student_seeking        = NULL,
    student_seeking_other  = NULL,
    grade                  = NULL,
    graduation_year        = NULL,
    open_to_mentorship     = false,
    banned_at              = now()
WHERE
     full_name ILIKE 'pheonix likes%'
  OR full_name ILIKE 'nick cherney%'
  OR full_name ILIKE 'alex tester%'
  OR full_name ILIKE 'claude student%'
  OR (full_name ILIKE 'phoenix cherney%' AND id NOT IN (
        SELECT id FROM public.profiles
         WHERE full_name ILIKE 'phoenix cherney%'
         ORDER BY created_at ASC LIMIT 1
     ))
  OR (full_name ILIKE 'sam student%' AND id NOT IN (
        SELECT id FROM public.profiles
         WHERE full_name ILIKE 'sam student%'
         ORDER BY created_at ASC LIMIT 1
     ));

-- Hard-delete inappropriate / test job postings. Cascades to applications
-- via the existing FK.
DELETE FROM public.jobs
WHERE
     title   ILIKE 'p. diddy oil chambers%'
  OR title   ILIKE 'dich digger%'
  OR title   ILIKE 'screening test%'
  OR title   ILIKE 'destroy stuff%'
  OR company ILIKE 'cherney wage%'
  OR company ILIKE 'big testing%'
  OR company ILIKE '%testies%';

-- Hard-delete student looking-for posts authored by anonymized accounts.
DELETE FROM public.student_posts
WHERE student_id IN (SELECT id FROM public.profiles WHERE banned_at IS NOT NULL);

-- Confirm before commit:
SELECT count(*) AS banned_profiles  FROM public.profiles WHERE banned_at IS NOT NULL;
SELECT count(*) AS remaining_jobs   FROM public.jobs;
SELECT count(*) AS remaining_posts  FROM public.student_posts;

-- Switch ROLLBACK ↔ COMMIT before running.
-- ROLLBACK;
COMMIT;
