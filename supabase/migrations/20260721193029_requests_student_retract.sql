-- A student can fully retract their own hand-raise while it hasn't become a live
-- engagement (before acceptance/conversation). Enables clean re-application and
-- gives automated loop tests a cleanup path. Live threads (in_conversation /
-- accepted) stay put — staff visibility and the member's record are preserved.
create policy requests_delete on public.requests for delete to authenticated
  using (
    public.app_is_admin()
    or (
      public.app_is_active()
      and student_id = (select auth.uid())
      and status in ('sent', 'withdrawn', 'declined')
    )
  );

notify pgrst, 'reload schema';
