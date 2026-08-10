-- ============================================================================
-- Minor/nit trust-model hardening from the 2026-07-24 review.
--
-- 1. notifications_select / _update were the only non-admin policy branches
--    missing app_is_active(). A disabled user is stopped only by the client
--    Gate; their JWT still read /rest/v1/notifications, whose `body` column
--    holds left(message.body, 140) of thread content.
-- 2. full_name was unguarded and unaudited, so an approved member could rename
--    themselves "CRMS Staff" — printed verbatim in the same byline position as
--    the real staff label inside a thread with a minor.
-- 3. offers.created_at and requests.created_at/decided_at were client-writable,
--    letting a member pin their offer to the top of a board that sorts on
--    created_at, or backdate a decision.
-- 4. The schema's default privileges auto-granted EXECUTE on every future
--    public function to anon + authenticated. That has already misfired once
--    (see 20260722003914, a corrective revoke for an auth.users trigger fn that
--    shipped RPC-callable while promoting accounts to active).
-- 5. stamp_message_sender flagged *every* admin message as staff, including one
--    sent by an admin who is the offer's own poster — their replies rendered as
--    "CRMS Staff" and the student was told "CRMS staff wrote in your thread",
--    losing the identity of the person actually offering the opportunity.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Disabled accounts stop receiving thread content through notifications.
--    The account_update carve-out keeps their own approval/status notices
--    readable, which is the one thing a pending or disabled user needs.
-- ----------------------------------------------------------------------------
drop policy notifications_select on public.notifications;
create policy notifications_select on public.notifications for select to authenticated
  using (
    user_id = (select auth.uid())
    and (public.app_is_active() or kind = 'account_update')
  );

drop policy notifications_update on public.notifications;
create policy notifications_update on public.notifications for update to authenticated
  using (
    user_id = (select auth.uid())
    and (public.app_is_active() or kind = 'account_update')
  )
  with check (
    user_id = (select auth.uid())
    and (public.app_is_active() or kind = 'account_update')
  );

-- ----------------------------------------------------------------------------
-- 2 + 3. Profile guard: no impersonating staff, and no silent renames.
-- ----------------------------------------------------------------------------
create or replace function public.enforce_profile_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is not null then
    if not public.app_is_admin() then
      if new.role is distinct from old.role
         or new.account_status is distinct from old.account_status
         or new.affiliation is distinct from old.affiliation
         or new.class_year is distinct from old.class_year
         or new.approved_at is distinct from old.approved_at
         or new.approved_by is distinct from old.approved_by then
        raise exception 'These fields can only be changed by CRMS staff.';
      end if;
      -- The thread byline renders `staff ? 'CRMS Staff' : name`, so a member
      -- who renames themselves into that string is indistinguishable from the
      -- real label to a student.
      if new.full_name is distinct from old.full_name
         and lower(new.full_name) ~ '(crms[[:space:]_-]*staff|crms[[:space:]_-]*connect|^[[:space:]]*admin([[:space:]]|$)|administrator|moderator)' then
        raise exception 'That name isn''t available. Please use your own name.';
      end if;
    end if;
  end if;
  -- created_at is not the client's to set.
  new.created_at := old.created_at;
  if new.account_status = 'active' and old.account_status = 'pending' then
    new.approved_at := coalesce(new.approved_at, now());
    new.approved_by := coalesce(new.approved_by, (select auth.uid()));
  end if;
  return new;
end $$;

-- Renames are auditable, so staff can see who a person used to be.
create function public.audit_profile_rename() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.full_name is distinct from old.full_name then
    insert into public.audit_log (actor_id, action, target_kind, target_id, detail)
    values ((select auth.uid()), 'rename_profile', 'user', new.id,
            jsonb_build_object('from', old.full_name, 'to', new.full_name));
  end if;
  return new;
end $$;

create trigger profiles_audit_rename after update on public.profiles
  for each row execute function public.audit_profile_rename();

revoke execute on function public.audit_profile_rename() from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3 (cont). Offers/requests: timestamps are the database's, not the client's.
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
    if new.status = 'draft' and old.status <> 'draft' then
      raise exception 'An offer that has been on the board can''t go back to draft. Close it instead.';
    end if;
  end if;
  -- The board sorts on created_at; a client-supplied value pins an offer to the
  -- top of it permanently.
  new.created_at := old.created_at;
  if new.hidden_at is not null and old.hidden_at is null then
    new.hidden_by := coalesce(new.hidden_by, (select auth.uid()));
  elsif new.hidden_at is null then
    new.hidden_by := null;
  end if;
  return new;
end $$;

create or replace function public.enforce_request_transition() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_poster uuid;
  v_is_student boolean;
  v_is_poster boolean;
begin
  select posted_by into v_poster from public.offers where id = new.offer_id;
  v_is_student := v_uid = new.student_id;
  v_is_poster := v_uid = v_poster;

  if new.offer_id is distinct from old.offer_id or new.student_id is distinct from old.student_id then
    raise exception 'A request cannot move to a different offer or student.';
  end if;
  -- Timestamps belong to the database. decided_at is re-derived below.
  new.created_at := old.created_at;
  new.decided_at := old.decided_at;

  if new.note is distinct from old.note
     and not (v_is_student and old.status in ('sent', 'withdrawn'))
     and not public.app_is_admin() then
    raise exception 'The note can only be edited by the student before the conversation starts.';
  end if;

  if new.status is distinct from old.status and v_uid is not null and not public.app_is_admin() then
    if v_is_student then
      if old.status in ('sent', 'in_conversation') and new.status = 'withdrawn' then
        null;
      elsif old.status = 'withdrawn' and new.status = 'sent' then
        if not exists (
          select 1
          from public.offers o
          join public.profiles p on p.id = o.posted_by
          where o.id = new.offer_id
            and o.status = 'open'
            and o.hidden_at is null
            and p.account_status = 'active'
            and p.open_to_requests
        ) then
          raise exception 'This door isn''t open for new knocks right now.';
        end if;
      else
        raise exception 'Students can only withdraw a pending request, or knock again on one they withdrew.';
      end if;
    elsif v_is_poster then
      if not (old.status in ('sent', 'in_conversation')
              and new.status in ('in_conversation', 'accepted', 'declined')) then
        raise exception 'Invalid status change for this request.';
      end if;
    else
      raise exception 'Only the student, the poster, or staff can update a request.';
    end if;
  end if;

  if new.status = 'sent' and old.status = 'withdrawn' then
    new.decided_at := null;
  elsif new.status in ('accepted', 'declined', 'withdrawn') and old.status not in ('accepted', 'declined', 'withdrawn') then
    new.decided_at := now();
  end if;
  return new;
end $$;

-- ----------------------------------------------------------------------------
-- 4. New public functions are no longer world-callable by default. Any function
--    added from here on must carry an explicit `grant execute ... to
--    authenticated`, which is the pattern v2_rebuild.sql §9 already uses.
-- ----------------------------------------------------------------------------
alter default privileges in schema public revoke all on routines from anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5. An admin writing in a thread they are a participant of speaks as
--    themselves, not as "CRMS Staff".
-- ----------------------------------------------------------------------------
create or replace function public.stamp_message_sender() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.is_staff := public.app_is_admin() and not exists (
    select 1
    from public.requests r
    join public.offers o on o.id = r.offer_id
    where r.id = new.request_id
      and (r.student_id = new.sender_id or o.posted_by = new.sender_id)
  );
  return new;
end $$;

notify pgrst, 'reload schema';
