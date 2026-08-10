-- ============================================================================
-- (Blocker) Re-knocking after a withdrawal hard-deleted the request and
-- cascade-deleted its whole staff-readable thread.
--
-- `raiseHand` (OfferDetail.tsx) issued a real DELETE on a withdrawn request to
-- free the `unique (offer_id, student_id)` slot before re-inserting. Because
-- messages.request_id is ON DELETE CASCADE, every message went with it — and a
-- withdrawn request can carry a full conversation, since enforce_request_
-- transition permits in_conversation → withdrawn. So a student who knocked,
-- talked with an adult, withdrew, then knocked again silently and irreversibly
-- erased that adult↔minor exchange from the record staff are promised they can
-- always read, with no audit_log row. The enabling policy also allowed deleting
-- `declined` threads, and the decline flow posts a message *before* moving to
-- declined — so a completed conversation was student-deletable too.
--
-- The fix removes the need to delete at all:
--   1. enforce_request_transition gains a student-side withdrawn → sent
--      re-knock, re-checking every condition requests_insert enforces (an
--      UPDATE bypasses that policy's with-check entirely).
--   2. notify_request_updated notifies the poster of a re-knock, so reviving a
--      row is indistinguishable from a fresh hand-raise on their side.
--   3. requests_delete's student branch drops 'declined' and now requires the
--      thread to be empty, so no policy path can destroy thread history.
--   4. Request deletion is audited.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Status machine: a withdrawn knock can be revived instead of deleted.
-- ----------------------------------------------------------------------------
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
  -- A re-knock rewrites the note, so 'withdrawn' joins 'sent' as an editable state.
  if new.note is distinct from old.note
     and not (v_is_student and old.status in ('sent', 'withdrawn'))
     and not public.app_is_admin() then
    raise exception 'The note can only be edited by the student before the conversation starts.';
  end if;

  if new.status is distinct from old.status and v_uid is not null and not public.app_is_admin() then
    if v_is_student then
      if old.status in ('sent', 'in_conversation') and new.status = 'withdrawn' then
        null; -- withdrawing a live knock
      elsif old.status = 'withdrawn' and new.status = 'sent' then
        -- Re-knock. This row is revived rather than deleted+reinserted, so the
        -- prior conversation survives. An UPDATE never runs requests_insert's
        -- with-check, so every gate that policy applies is re-asserted here.
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

  -- A revived knock is pending again, not decided.
  if new.status = 'sent' and old.status = 'withdrawn' then
    new.decided_at := null;
  elsif new.status in ('accepted', 'declined', 'withdrawn') and old.status not in ('accepted', 'declined', 'withdrawn') then
    new.decided_at := now();
  end if;
  return new;
end $$;

-- ----------------------------------------------------------------------------
-- 2. The poster hears about a re-knock exactly as they would a fresh one.
-- ----------------------------------------------------------------------------
create or replace function public.notify_request_updated() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_poster uuid;
  v_offer_title text;
  v_student_name text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  select o.posted_by, o.title into v_poster, v_offer_title from public.offers o where o.id = new.offer_id;
  select full_name into v_student_name from public.profiles where id = new.student_id;

  if new.status = 'withdrawn' then
    insert into public.notifications (user_id, kind, title, body, link)
    values (v_poster, 'request_update', v_student_name || ' withdrew their hand-raise',
            'On “' || v_offer_title || '”', '/offers/' || new.offer_id || '/manage');
  elsif new.status = 'sent' and old.status = 'withdrawn' then
    -- Re-knock: same copy as notify_request_created, so the poster's inbox
    -- reads identically whether the row was inserted or revived.
    insert into public.notifications (user_id, kind, title, body, link)
    values (v_poster, 'request_received', v_student_name || ' raised a hand',
            'On your offer “' || v_offer_title || '”', '/offers/' || new.offer_id || '/manage');
  elsif new.status in ('in_conversation', 'accepted', 'declined') then
    insert into public.notifications (user_id, kind, title, body, link)
    values (new.student_id, 'request_update',
            case new.status
              when 'in_conversation' then 'They want to talk!'
              when 'accepted' then 'You''re in — hand-raise accepted'
              else 'An update on your hand-raise'
            end,
            '“' || v_offer_title || '” — ' ||
            case new.status
              when 'in_conversation' then 'the poster replied to your note.'
              when 'accepted' then 'the poster accepted your request.'
              else 'this one didn''t work out, but the board is always open.'
            end,
            '/requests/' || new.id);
  end if;

  -- An accepted hand-raise may fill the offer.
  if new.status = 'accepted' then
    update public.offers o
    set status = 'filled'
    where o.id = new.offer_id
      and o.status = 'open'
      and o.spots <= (select count(*) from public.requests r
                      where r.offer_id = o.id and r.status = 'accepted');
  end if;
  return new;
end $$;

-- ----------------------------------------------------------------------------
-- 3. No policy path can destroy thread history.
--
-- The student branch keeps the "retract a knock nobody engaged with" escape
-- hatch, but only while the thread is genuinely empty. 'declined' is dropped
-- outright: the decline flow posts a softening message first, so a declined
-- thread is by construction a completed adult↔minor conversation.
-- Staff keep an unrestricted delete (a deliberate, now-audited moderation act).
-- ----------------------------------------------------------------------------
drop policy requests_delete on public.requests;
create policy requests_delete on public.requests for delete to authenticated
  using (
    public.app_is_admin()
    or (
      public.app_is_active()
      and student_id = (select auth.uid())
      and status in ('sent', 'withdrawn')
      and not exists (select 1 from public.messages m where m.request_id = requests.id)
    )
  );

-- ----------------------------------------------------------------------------
-- 4. Request deletion is audited (mirrors audit_offer_deleted). BEFORE DELETE,
--    not AFTER: messages.request_id is ON DELETE CASCADE, and the cascade runs
--    as its own AFTER-row trigger, so an AFTER trigger would race it and record
--    an unreliable message count. BEFORE, the thread is still intact.
-- ----------------------------------------------------------------------------
create function public.audit_request_deleted() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_log (actor_id, action, target_kind, target_id, detail)
  values (
    (select auth.uid()), 'delete_request', 'request', old.id,
    jsonb_build_object(
      'offer_id', old.offer_id,
      'student_id', old.student_id,
      'status', old.status,
      'messages', (select count(*) from public.messages m where m.request_id = old.id)
    )
  );
  return old;
end $$;

create trigger requests_audit_deleted before delete on public.requests
  for each row execute function public.audit_request_deleted();

revoke execute on function public.audit_request_deleted() from public, anon, authenticated;

notify pgrst, 'reload schema';
