-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 094: consolidate overlapping permissive RLS policies
-- (performance advisor: multiple_permissive_policies) + close two gate bypasses
--
-- The advisor flagged 8 (role, action) combinations where two PERMISSIVE policies
-- are OR'd for the same command, so both are evaluated on every row. Two of these
-- weren't just a perf smell — the redundant policy silently widened access:
--
--   • profiles SELECT: `profiles_select_authenticated` (USING true) OR'd away the
--     `profiles_select_pending_own_only` gate, so a non-active account could read
--     every profile. All current accounts are 'active' (the approval gate was
--     dropped in mig 050) so this is behavior-neutral today, but it restores the
--     intended posture: active users see the directory, non-active see only self.
--     Drop the blanket policy; `profiles_select_pending_own_only`
--     ((id = auth.uid()) OR is_active_or_admin()) becomes the sole SELECT grant.
--     The RESTRICTIVE `profiles_hide_admin_rows` still applies on top.
--
--   • user_reports INSERT: `user_reports_insert_self` (auth.uid() = reporter_id)
--     OR'd away the active-account check in `user_reports_insert_authed`
--     (… AND is_active_or_admin()). Drop the ungated duplicate; keep the gated one.
--
-- The other two are pure redundancy (no access change):
--   • user_reports SELECT: `user_reports_select_admin` (is_admin()) is a strict
--     subset of `user_reports_select_self_or_admin` (self OR admin). Drop it.
--   • student_posts: `student_posts_owner` is a FOR ALL policy, so it overlapped
--     the FOR SELECT `student_posts_read_open_or_admin` on reads (where the owner
--     case is already covered). Replace it with command-scoped INSERT/UPDATE/DELETE
--     policies — identical write permissions, no SELECT overlap.
--
-- Validated in a rolled-back transaction: 0 (role, cmd) combos with >1 permissive
-- policy remain on profiles / student_posts / user_reports.
-- ─────────────────────────────────────────────────────────────────────────────

-- profiles: drop the blanket SELECT; rely on the own-or-active gate
DROP POLICY profiles_select_authenticated ON public.profiles;

-- user_reports: drop the ungated INSERT duplicate and the redundant admin SELECT
DROP POLICY user_reports_insert_self  ON public.user_reports;
DROP POLICY user_reports_select_admin ON public.user_reports;

-- student_posts: replace the FOR ALL owner policy with command-scoped write policies
DROP POLICY student_posts_owner ON public.student_posts;

CREATE POLICY student_posts_insert_own ON public.student_posts
  FOR INSERT TO public
  WITH CHECK (student_id = (select auth.uid()));

CREATE POLICY student_posts_update_own ON public.student_posts
  FOR UPDATE TO public
  USING (student_id = (select auth.uid()))
  WITH CHECK (student_id = (select auth.uid()));

CREATE POLICY student_posts_delete_own ON public.student_posts
  FOR DELETE TO public
  USING (student_id = (select auth.uid()));
