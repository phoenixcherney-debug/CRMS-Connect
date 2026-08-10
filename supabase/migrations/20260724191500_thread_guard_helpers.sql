-- ============================================================================
-- Fix for the two thread-protection policies added in 20260724190000 /
-- 20260724190500: both reference another RLS-protected table inline.
--
--   offers_delete   → `not exists (select 1 from public.requests …)`
--   requests_delete → `not exists (select 1 from public.messages …)`
--
-- Evaluating those subqueries re-enters requests_select / messages_select,
-- which themselves reference public.offers, which re-enters offers_select — so
-- every delete raised 42P17 "infinite recursion detected in policy", including
-- the legitimate retract path an existing integration test covers.
--
-- This schema already has a convention for exactly this (v2_rebuild.sql §4:
-- "Helper functions (SECURITY DEFINER bypasses RLS → no policy recursion)"),
-- used by app_is_admin / app_user_active / app_has_request_on_offer. These two
-- predicates were written inline instead. Route them through helpers.
--
-- Both keep the `authenticated` EXECUTE grant that the others do, because RLS
-- policy expressions execute as the calling role. As with app_user_active, that
-- also makes them RPC-callable; each returns only a boolean existence answer
-- for an id the caller supplies.
-- ============================================================================

create function public.app_offer_has_requests(p_offer uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.requests where offer_id = p_offer)
$$;

create function public.app_request_has_messages(p_request uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.messages where request_id = p_request)
$$;

revoke execute on function public.app_offer_has_requests(uuid) from public, anon;
revoke execute on function public.app_request_has_messages(uuid) from public, anon;
grant execute on function public.app_offer_has_requests(uuid) to authenticated;
grant execute on function public.app_request_has_messages(uuid) to authenticated;

-- An offer anyone has knocked on is not deletable by its owner (blocker 1).
drop policy offers_delete on public.offers;
create policy offers_delete on public.offers for delete to authenticated
  using (
    public.app_is_admin()
    or (
      posted_by = (select auth.uid())
      and status = 'draft'
      and not public.app_offer_has_requests(id)
    )
  );

-- A thread that carries messages is not deletable by the student (blocker 2).
drop policy requests_delete on public.requests;
create policy requests_delete on public.requests for delete to authenticated
  using (
    public.app_is_admin()
    or (
      public.app_is_active()
      and student_id = (select auth.uid())
      and status in ('sent', 'withdrawn')
      and not public.app_request_has_messages(id)
    )
  );

notify pgrst, 'reload schema';
