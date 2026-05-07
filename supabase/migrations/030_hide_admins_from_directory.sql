-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 030: Hide admin profiles from the directory (audit pass 5 §5e)
--
-- The /people page filters its query by role, but a curious authenticated user
-- can dump the raw `profiles` REST endpoint and see admin rows. Tighten the
-- SELECT policy so admins are only visible to themselves and to other admins.
--
-- Banned profile filter from migration 023 is preserved.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_authenticated"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    -- Always: the row is your own.
    id = auth.uid()
    -- Or: the caller is an admin (sees everything).
    OR public.is_admin()
    -- Or: the row is non-admin AND not banned.
    OR (role <> 'admin' AND banned_at IS NULL)
  );

NOTIFY pgrst, 'reload schema';
