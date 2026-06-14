// All columns of public.jobs EXCEPT `contact_email`.
//
// contact_email is column-level revoked from anon/authenticated at the database
// level (migration 084), so `select('*')` on jobs now fails for normal clients.
// Use this constant for any job read; fetch the contact email separately via the
// `job_contact_email(job_uuid)` RPC, which returns it only to the poster, an
// admin, or an applicant whose application has been accepted.
export const JOB_COLUMNS =
  'id, created_at, posted_by, title, company, location, job_type, description, ' +
  'how_to_apply, deadline, is_active, expected_weekly_hours, location_type, ' +
  'industry, opportunity_type, opportunity_type_other, start_date, end_date, ' +
  'compensation, custom_questions, is_draft, custom_questions_v2, hidden_by_admin_at'
