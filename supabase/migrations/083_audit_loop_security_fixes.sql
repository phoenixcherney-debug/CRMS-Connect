-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 083: Audit-loop security fixes (iteration 1)
--
-- Two server-side RLS defects confirmed by the cross-role boundary audit:
--
--   1. notifications_insert_definer (036) used WITH CHECK (auth.uid() IS NOT NULL
--      OR true), which evaluates to TRUE — letting any authenticated client (and,
--      since the policy targets PUBLIC, even anon if granted) INSERT a notification
--      addressed to ANY user_id. That is a notification-spoofing / phishing vector.
--      Notifications are only ever created by the SECURITY DEFINER trigger
--      messages_enqueue_dm_notification (which is postgres-owned and bypasses RLS),
--      and NO client code inserts into notifications, so we can safely restrict the
--      policy to "you may only insert a notification addressed to yourself".
--
--   2. jobs_select_authenticated (025) is USING (true), which exposes every job's
--      unpublished DRAFT rows (is_draft = true) to every authenticated user. The
--      empty-feed fix in 025 over-corrected; we keep all NON-draft rows readable
--      (so the community feed / closed-opportunity views keep working) but hide
--      drafts from everyone except the poster and admins.
--
--      NOTE: the related contact_email column exposure is NOT fully fixed here.
--      jobs.contact_email is still readable via SELECT * on the base table because
--      RLS cannot hide a single column. The intended fix (route public reads
--      through the jobs_public view + column GRANTs) is a multi-file client change
--      that must be validated against the running app and is tracked separately.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Stop notification spoofing ────────────────────────────────────────────
DROP POLICY IF EXISTS notifications_insert_definer ON public.notifications;
CREATE POLICY notifications_insert_definer ON public.notifications
  FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ── 2. Hide unpublished job drafts from non-owners ───────────────────────────
DROP POLICY IF EXISTS "jobs_select_authenticated" ON public.jobs;
CREATE POLICY "jobs_select_authenticated"
  ON public.jobs
  FOR SELECT
  TO authenticated
  USING (
    is_draft IS NOT TRUE
    OR posted_by = (SELECT auth.uid())
    OR (SELECT public.is_admin())
  );

NOTIFY pgrst, 'reload schema';
