-- ============================================================================
-- (Major, second half) Push subscriptions survived sign-out.
--
-- The client half calls disablePush() during sign-out. This half fixes the
-- device hand-off that made re-enabling impossible for the next user:
-- push_subscriptions.endpoint is UNIQUE, and enablePush upserts on it, but
-- push_sub_update's `using (user_id = auth.uid())` denies the update when the
-- endpoint row still belongs to the previous user — so on a shared device the
-- new user could never turn push on at all.
--
-- A push endpoint identifies one browser install. Whoever is signed in on that
-- browser is its rightful owner, so claiming it from a stale row is correct.
-- SECURITY DEFINER because the caller cannot, by design, see or delete another
-- user's subscription rows.
-- ============================================================================

create function public.claim_push_endpoint(p_endpoint text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.app_is_active() then
    raise exception 'Only an active account can turn on notifications.';
  end if;
  -- Only ever clears *other* users' claim on this browser; the caller's own row
  -- is left in place for the upsert that follows to update.
  delete from public.push_subscriptions
  where endpoint = p_endpoint and user_id <> (select auth.uid());
end $$;

revoke execute on function public.claim_push_endpoint(text) from public, anon;
grant execute on function public.claim_push_endpoint(text) to authenticated;

notify pgrst, 'reload schema';
