-- ============================================================================
-- (Blocker) A student who already raised a hand keeps read visibility of the
-- offer even after staff unlist it.
--
-- The previous offers_select policy required `hidden_at is null` for every
-- non-owner/non-admin viewer, with no carve-out for a student who already has a
-- request — so when staff unlisted an offer, that student's still-valid
-- `requests` rows came back with `offer: null`, null-dereferencing their
-- thread / My requests / home into a crash loop.
--
-- This mirrors the applicant carve-out already present for disabled posters:
-- an applicant sees the offer regardless of hidden_at or poster status, so
-- their existing thread resolves. The open board is unchanged for everyone
-- else (still: not hidden AND poster active).
-- ============================================================================

drop policy offers_select on public.offers;
create policy offers_select on public.offers for select to authenticated
  using (
    public.app_is_admin()
    or posted_by = (select auth.uid())
    or (
      public.app_is_active()
      and status <> 'draft'
      and (
        -- Normal open-board visibility: listed, and the poster is still active.
        (hidden_at is null and public.app_user_active(posted_by))
        -- Applicant carve-out: this student already raised a hand, so keep the
        -- offer readable — even if it's since been unlisted or the poster was
        -- disabled — so their thread / requests / home still resolve.
        or public.app_has_request_on_offer(id)
      )
    )
  );

notify pgrst, 'reload schema';
