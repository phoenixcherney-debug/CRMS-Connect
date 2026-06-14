-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 084: column-level lockdown of jobs.contact_email (completes A1)
--
-- Background: migration 023 created the jobs_public view + job_contact_email()
-- RPC to keep contact_email private, but migration 025 reverted the jobs SELECT
-- policy to USING(true) to fix an empty-feed bug — which re-exposed
-- contact_email to every authenticated user via `select *` on the base table.
-- RLS cannot hide a single column, so we enforce it with column-level GRANTs:
-- every authenticated/anon SELECT of jobs is now restricted to the non-sensitive
-- columns, and `select('*')` (or any embed pulling contact_email) is rejected
-- with "permission denied for column contact_email".
--
-- The poster, an admin, or an accepted applicant read the address through the
-- existing SECURITY DEFINER job_contact_email(job_uuid) RPC (unchanged). The
-- client was updated to read jobs via an explicit column list (src/lib/jobColumns.ts)
-- and to fetch contact_email via that RPC where appropriate.
--
-- service_role is unaffected (it bypasses these grants), so edge functions and
-- SECURITY DEFINER routines keep working.
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE SELECT ON public.jobs FROM anon, authenticated;

GRANT SELECT (
  id, created_at, posted_by, title, company, location, job_type, description,
  how_to_apply, deadline, is_active, expected_weekly_hours, location_type,
  industry, opportunity_type, opportunity_type_other, start_date, end_date,
  compensation, custom_questions, is_draft, custom_questions_v2, hidden_by_admin_at
) ON public.jobs TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
