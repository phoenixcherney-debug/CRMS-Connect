-- ============================================================================
-- (Major) A paused member's offers stayed on the board, contradicting the
-- documented invariant and dead-ending the student.
--
-- `open_to_requests = false` was checked only in requests_insert and in
-- OfferDetail's render. Neither offers_select nor the board query filtered on
-- it, so a paused member's `open` offers kept appearing on /board and in
-- StudentHome's "Fresh on the board". A student clicked through, got no knock
-- form, and read "This member is taking a pause from new requests right now" —
-- a dead door presented as an open one.
--
-- The schema already stated the opposite:
--   comment on column public.profiles.open_to_requests is
--     'Member pause switch: false hides their open offers from the board.'
--
-- This makes that comment true. The pause joins the poster-active check in the
-- open-board branch, while the existing applicant carve-out is untouched: a
-- student who already knocked keeps visibility of the offer so their thread,
-- My requests, and home still resolve.
-- ============================================================================

-- Poster is visible on the open board: active *and* accepting new knocks.
create function public.app_user_open(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = p_id and account_status = 'active' and open_to_requests
  )
$$;

revoke execute on function public.app_user_open(uuid) from public, anon;
grant execute on function public.app_user_open(uuid) to authenticated;

drop policy offers_select on public.offers;
create policy offers_select on public.offers for select to authenticated
  using (
    public.app_is_admin()
    or posted_by = (select auth.uid())
    or (
      public.app_is_active()
      and status <> 'draft'
      and (
        -- Normal open-board visibility: listed, poster active and un-paused.
        (hidden_at is null and public.app_user_open(posted_by))
        -- Applicant carve-out: this student already raised a hand, so keep the
        -- offer readable — even if it's since been unlisted, the poster was
        -- disabled, or they've paused — so their thread still resolves.
        or public.app_has_request_on_offer(id)
      )
    )
  );

notify pgrst, 'reload schema';
