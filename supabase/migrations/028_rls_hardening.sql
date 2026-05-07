-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 028: RLS audit (audit pass 4 §4)
--
-- This migration is read-only — it raises NOTICEs you can read in the
-- Supabase SQL editor's Messages panel after `Run`. It walks every public
-- table, prints the policy count per cmd, flags tables without RLS, and dumps
-- the contents of pg_policies for review.
--
-- We deliberately do NOT yet revoke column-level SELECT on jobs.contact_email
-- because the client still does `select('*')` from `jobs` in several places.
-- A REVOKE here would silently break those reads. The fix is to first migrate
-- every read path to `public.jobs_public` (the column-restricted view from
-- migration 023), then revoke column SELECT in a follow-up migration. Until
-- then, contact_email is hidden in `jobs_public` but a curious authenticated
-- user could still read it via direct `select` on `jobs`. This is documented
-- as a known gap.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  rec RECORD;
  rls_enabled BOOLEAN;
  policies_count INT;
BEGIN
  RAISE NOTICE '──────────────────────────────────────────────────';
  RAISE NOTICE '  RLS audit — public schema';
  RAISE NOTICE '──────────────────────────────────────────────────';
  FOR rec IN
    SELECT t.tablename
      FROM pg_tables t
     WHERE t.schemaname = 'public'
       AND t.tablename NOT LIKE 'pg_%'
     ORDER BY t.tablename
  LOOP
    SELECT relrowsecurity INTO rls_enabled
      FROM pg_class
     WHERE relname = rec.tablename
       AND relnamespace = 'public'::regnamespace;

    SELECT count(*) INTO policies_count
      FROM pg_policies p
     WHERE p.schemaname = 'public' AND p.tablename = rec.tablename;

    IF NOT COALESCE(rls_enabled, false) THEN
      RAISE NOTICE '  %  : RLS DISABLED  (% policies present but inactive)', rec.tablename, policies_count;
    ELSIF policies_count = 0 THEN
      RAISE NOTICE '  %  : RLS enabled but NO POLICIES — table is unreadable to non-owners', rec.tablename;
    ELSE
      RAISE NOTICE '  %  : RLS on, % policies', rec.tablename, policies_count;
    END IF;
  END LOOP;

  RAISE NOTICE '──────────────────────────────────────────────────';
  RAISE NOTICE '  Policy detail';
  RAISE NOTICE '──────────────────────────────────────────────────';
  FOR rec IN
    SELECT tablename, policyname, cmd, roles::text AS roles_text, qual, with_check
      FROM pg_policies
     WHERE schemaname = 'public'
     ORDER BY tablename, policyname
  LOOP
    RAISE NOTICE '  % :: % (%) for % — using=%  check=%',
      rec.tablename, rec.policyname, rec.cmd, rec.roles_text,
      rec.qual, rec.with_check;
  END LOOP;
END $$;
