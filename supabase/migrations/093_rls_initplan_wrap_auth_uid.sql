-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 093: wrap auth.uid() in a scalar subselect across RLS policies
-- (performance advisor: auth_rls_initplan — A7 remainder)
--
-- 57 RLS policies across 19 tables call `auth.uid()` directly, so Postgres
-- re-evaluates it once per row. Wrapping it as `(select auth.uid())` turns it
-- into an InitPlan that runs once per query — identical semantics (auth.uid()
-- is constant within a statement), materially cheaper at scale. This is the
-- fix Supabase documents:
--   https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
--
-- Implemented as a catalog-driven rewrite rather than 57 hand-written ALTERs so
-- the transformation is auditable and exact: for every policy on the listed
-- tables whose USING/WITH CHECK still contains an unwrapped `auth.uid()`, we
-- ALTER POLICY with the same expression, `auth.uid()` → `(select auth.uid())`.
-- The guard `select auth.uid()` not-present makes it idempotent and skips the
-- two policies already wrapped earlier (jobs_select_authenticated,
-- notifications_insert_definer). cmd / roles / permissive are untouched.
--
-- Validated in a rolled-back transaction against the live DB: 57 policies
-- rewritten, 0 unwrapped occurrences remaining.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE r record; ddl text;
BEGIN
  FOR r IN
    SELECT tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (ARRAY[
        'applicant_notes','applications','availability_slots','career_history',
        'company_meta','conversations','events','jobs','marketplace_listings',
        'meeting_requests','mentor_shortlist','messages','notifications',
        'opportunity_views','profiles','push_subscriptions','saved_jobs',
        'student_posts','user_reports'])
      AND position('auth.uid()' in coalesce(qual,'') || ' ' || coalesce(with_check,'')) > 0
      AND position('select auth.uid()' in lower(coalesce(qual,'') || ' ' || coalesce(with_check,''))) = 0
  LOOP
    ddl := format('ALTER POLICY %I ON public.%I', r.policyname, r.tablename);
    IF r.qual IS NOT NULL THEN
      ddl := ddl || ' USING (' || replace(r.qual, 'auth.uid()', '(select auth.uid())') || ')';
    END IF;
    IF r.with_check IS NOT NULL THEN
      ddl := ddl || ' WITH CHECK (' || replace(r.with_check, 'auth.uid()', '(select auth.uid())') || ')';
    END IF;
    EXECUTE ddl;
  END LOOP;
END $$;
