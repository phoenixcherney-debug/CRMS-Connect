-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 092: take internal-only SECURITY DEFINER functions off the public
-- RPC surface (security advisor 0028/0029)
--
-- The security linter flagged a set of SECURITY DEFINER functions as callable by
-- `anon` / `authenticated` via /rest/v1/rpc/*. For the functions below that
-- exposure is pure attack surface — none are meant to be invoked directly:
--   • 8 trigger functions (return `trigger`): they fire from row-level triggers
--     as the table owner and can never be usefully called over PostgREST.
--   • close_expired_jobs(): a maintenance routine intended to run via pg_cron
--     (`SELECT cron.schedule(..., 'SELECT close_expired_jobs()')`), which runs as
--     the job owner, not as anon/authenticated. No client code references it.
--
-- So we revoke EXECUTE from PUBLIC/anon/authenticated. service_role keeps its
-- access (it bypasses these grants), so cron/edge paths are unaffected, and the
-- triggers themselves keep firing (trigger execution does not consult the
-- caller's EXECUTE privilege on the trigger function).
--
-- NOTE: is_admin()/is_active_or_admin() are deliberately NOT included — they are
-- SECURITY DEFINER helpers evaluated inside RLS policies as the querying role and
-- MUST retain EXECUTE for anon/authenticated, or every RLS check would break.
-- Likewise the user-facing RPCs (community_stats, directory_member_count,
-- list_mentor_wall, opportunity_view_stats, event_rsvp_counts, job_contact_email,
-- delete_own_account, recover_own_account) and the admin_* RPCs (already locked
-- to authenticated + internal is_admin() check in migration 085) stay callable.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    -- trigger functions (return trigger; never invoked via RPC)
    'public.handle_new_user()',
    'public.profiles_role_immutable_trg()',
    'public.validate_profile_email_role()',
    'public.conversations_check_outreach_consent_trg()',
    'public.messages_check_outreach_consent_trg()',
    'public.meeting_requests_enqueue_notification()',
    'public.messages_enqueue_dm_notification()',
    'public.event_rsvps_enforce_capacity()',
    -- pg_cron-only maintenance routine
    'public.close_expired_jobs()'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
  END LOOP;
END $$;
