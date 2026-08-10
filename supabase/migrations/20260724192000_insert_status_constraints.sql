-- ============================================================================
-- (Major) The status machines were enforced only on UPDATE — any status could
-- be set at INSERT.
--
-- `requests_transition` is a BEFORE UPDATE trigger, and requests_insert
-- validated the actor, the offer and the poster but never `status` or
-- `decided_at`. A student POSTing straight to /rest/v1/requests with their own
-- JWT could create a row already `accepted`, bypassing the poster entirely —
-- and that row then reads "Accepted" in MyRequests, in the poster's spot count,
-- in admin_overview().accepted_total and in the public
-- community_stats().connections. SPEC.md:122 claims the request status machine
-- is trigger-enforced; on the insert path it wasn't.
--
-- The same gap existed on the other two insert policies: an offer could be
-- inserted `filled`, and a report inserted `resolved` so it never reached the
-- staff queue.
--
-- Each policy now pins the initial status to what the column default already
-- says it should be, so the only way out of it is a transition the triggers
-- police.
-- ============================================================================

-- requests: a hand-raise always starts 'sent' and undecided.
drop policy requests_insert on public.requests;
create policy requests_insert on public.requests for insert to authenticated
  with check (
    student_id = (select auth.uid())
    and public.app_role() = 'student'
    and public.app_is_active()
    and status = 'sent'
    and decided_at is null
    and exists (
      select 1
      from public.offers o
      join public.profiles p on p.id = o.posted_by
      where o.id = offer_id
        and o.status = 'open'
        and o.hidden_at is null
        and p.account_status = 'active'
        and p.open_to_requests
    )
  );

-- offers: a new offer is either a private draft or on the board — never
-- pre-filled, never pre-closed.
drop policy offers_insert on public.offers;
create policy offers_insert on public.offers for insert to authenticated
  with check (
    posted_by = (select auth.uid())
    and public.app_is_active()
    and public.app_role() in ('member', 'admin')
    and status in ('draft', 'open')
  );

-- reports: every report reaches the staff queue open.
drop policy reports_insert on public.reports;
create policy reports_insert on public.reports for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and public.app_is_active()
    and status = 'open'
  );

notify pgrst, 'reload schema';
