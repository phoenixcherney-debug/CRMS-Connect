-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 085: defense-in-depth on admin RPCs (A5) + FK indexes (A7)
--
-- A5 — Every admin_* RPC was EXECUTE-able by anon (via the default PUBLIC grant).
-- They are already gated internally by is_admin()/caller_role checks, so this is
-- defense-in-depth: revoke EXECUTE from PUBLIC and grant only to authenticated
-- (admins are authenticated; the internal check still blocks non-admins).
-- service_role keeps its own access, so edge functions are unaffected.
--
-- A7 — Index the foreign-key columns the performance advisor flagged as
-- unindexed (cheap now; prevents seq-scan joins/cascades as data grows).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── A5: admin RPC execute grants ─────────────────────────────────────────────
DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.admin_ban_user(uuid)',
    'public.admin_unban_user(uuid)',
    'public.admin_delete_user(uuid)',
    'public.admin_get_user_email(uuid)',
    'public.admin_list_users()',
    'public.admin_list_conversations(integer, integer)',
    'public.admin_set_hidden(text, uuid, boolean)',
    'public.admin_set_user_role(uuid, text)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
  END LOOP;
END $$;

-- ── A7: index unindexed foreign keys ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_applicant_notes_applicant_id ON public.applicant_notes(applicant_id);
CREATE INDEX IF NOT EXISTS idx_applicant_notes_author_id    ON public.applicant_notes(author_id);
CREATE INDEX IF NOT EXISTS idx_company_meta_updated_by       ON public.company_meta(updated_by);
CREATE INDEX IF NOT EXISTS idx_follows_following_id          ON public.follows(following_id);
CREATE INDEX IF NOT EXISTS idx_mentor_shortlist_student_id   ON public.mentor_shortlist(student_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id            ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_views_viewer_id   ON public.opportunity_views(viewer_id);
CREATE INDEX IF NOT EXISTS idx_pinned_jobs_job_id            ON public.pinned_jobs(job_id);
CREATE INDEX IF NOT EXISTS idx_saved_jobs_job_id             ON public.saved_jobs(job_id);
CREATE INDEX IF NOT EXISTS idx_user_reports_reviewed_by      ON public.user_reports(reviewed_by);

NOTIFY pgrst, 'reload schema';
