-- ============================================================================
-- (Blocker) Round-tripping an offer through `draft` let a member cascade-delete
-- a student's entire thread.
--
-- `offers_delete` (v2_rebuild.sql:578) permitted an owner to delete an offer
-- whose status was 'draft', and nothing stopped that owner demoting a live
-- offer back to draft first: `offers_update` placed no constraint on `status`,
-- and `enforce_offer_guard` protected only hidden_at / hidden_by / posted_by.
-- Since requests.offer_id was ON DELETE CASCADE and messages.request_id is,
-- two ordinary PostgREST calls —
--     PATCH  /offers?id=eq.X  {"status":"draft"}
--     DELETE /offers?id=eq.X
-- — erased every hand-raise and every message on that offer, silently: the only
-- offer triggers were AFTER UPDATE, so no audit_log row was ever written.
--
-- Three independent locks, so no single regression re-opens the path:
--   1. 'draft' becomes a one-way door for non-staff (guard trigger).
--   2. offers_delete additionally requires the offer to carry no requests.
--   3. requests.offer_id becomes ON DELETE RESTRICT, so Postgres itself refuses
--      to cascade a thread away even if both policies above regress.
-- And every offer delete now writes an audit_log row.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. 'draft' is a one-way door — an offer that reached the board never returns
--    to the one status that makes it deletable.
-- ----------------------------------------------------------------------------
create or replace function public.enforce_offer_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is not null and not public.app_is_admin() then
    if new.hidden_at is distinct from old.hidden_at
       or new.hidden_by is distinct from old.hidden_by
       or new.posted_by is distinct from old.posted_by then
      raise exception 'Only CRMS staff can change these fields.';
    end if;
    -- An offer students could already see (and knock on) can be closed or
    -- filled, but never demoted back to a deletable draft.
    if new.status = 'draft' and old.status <> 'draft' then
      raise exception 'An offer that has been on the board can''t go back to draft. Close it instead.';
    end if;
  end if;
  if new.hidden_at is not null and old.hidden_at is null then
    new.hidden_by := coalesce(new.hidden_by, (select auth.uid()));
  elsif new.hidden_at is null then
    new.hidden_by := null;
  end if;
  return new;
end $$;

-- ----------------------------------------------------------------------------
-- 2. An offer that anyone has knocked on is not deletable by its owner.
-- ----------------------------------------------------------------------------
drop policy offers_delete on public.offers;
create policy offers_delete on public.offers for delete to authenticated
  using (
    public.app_is_admin()
    or (
      posted_by = (select auth.uid())
      and status = 'draft'
      and not exists (select 1 from public.requests r where r.offer_id = offers.id)
    )
  );

-- ----------------------------------------------------------------------------
-- 3. The database refuses to cascade a thread away, whatever the policies say.
--    Staff who genuinely need to remove an offer must delete its requests first
--    (an audited, deliberate act) rather than erasing them as a side effect.
-- ----------------------------------------------------------------------------
alter table public.requests drop constraint requests_offer_id_fkey;
alter table public.requests add constraint requests_offer_id_fkey
  foreign key (offer_id) references public.offers (id) on delete restrict;

-- ----------------------------------------------------------------------------
-- 4. Offer deletion is audited (mirrors notify_offer_moderated's audit rows).
-- ----------------------------------------------------------------------------
create function public.audit_offer_deleted() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_log (actor_id, action, target_kind, target_id, detail)
  values (
    (select auth.uid()), 'delete_offer', 'offer', old.id,
    jsonb_build_object('title', old.title, 'status', old.status, 'posted_by', old.posted_by)
  );
  return old;
end $$;

create trigger offers_audit_deleted after delete on public.offers
  for each row execute function public.audit_offer_deleted();

-- Trigger function: never RPC-callable (the schema's default privileges grant
-- EXECUTE on new routines to anon/authenticated — see 20260722003914).
revoke execute on function public.audit_offer_deleted() from public, anon, authenticated;

notify pgrst, 'reload schema';
