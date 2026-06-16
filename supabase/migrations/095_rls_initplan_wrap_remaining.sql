-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 095: wrap auth.uid() on the remaining RLS policies (auth_rls_initplan)
--
-- Migration 093 missed 6 policies on `follows` and `pinned_jobs` because their
-- policy names contain spaces/capitals (e.g. "Users can pin jobs") and the table
-- list it was built from excluded them. This pass is table-agnostic: it rewrites
-- every public policy that still has an unwrapped `auth.uid()`, so it catches
-- those 6 and anything similar. Same idempotent guard and semantics as 093.
--
-- Validated in a rolled-back transaction: 0 unwrapped auth.uid() remain in any
-- public RLS policy afterwards.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE r record; ddl text;
BEGIN
  FOR r IN
    SELECT tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
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
