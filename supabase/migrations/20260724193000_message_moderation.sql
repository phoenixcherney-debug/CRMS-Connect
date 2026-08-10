-- ============================================================================
-- (Major) Staff had no way to remove an abusive message.
--
-- The schema supported redaction — messages.hidden_at / hidden_by, and
-- messages_select already excludes hidden rows for non-admins — but no client
-- ever wrote it, and messages_update ("using (app_is_admin())") had zero call
-- sites. Disabling the adult's account does not hide their already-sent
-- messages either, because messages_select only requires the *viewer* to be
-- active and a participant. So an inappropriate message to a minor stayed
-- permanently visible to that minor with no in-app remedy.
--
-- The client half of this fix adds the staff "Remove this message" control and
-- a per-message report target. This half makes that write safe and auditable:
--
--   1. enforce_message_guard stamps hidden_by (mirroring enforce_offer_guard)
--      and makes the message body itself immutable — the new staff write path
--      can hide history, never rewrite it.
--   2. notify_message_moderated writes hide_message / unhide_message audit rows
--      (mirroring notify_offer_moderated).
--
-- Deliberately unlike notify_offer_moderated, the *sender* is not notified:
-- unlisting someone's own offer is feedback they need, whereas telling someone
-- their abusive message to a minor was just removed mainly tips them off.
-- The action is on the staff audit log either way.
-- ============================================================================

create function public.enforce_message_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Moderation hides a message; it never rewrites what was said or who said it.
  if new.body is distinct from old.body
     or new.sender_id is distinct from old.sender_id
     or new.request_id is distinct from old.request_id
     or new.is_staff is distinct from old.is_staff
     or new.created_at is distinct from old.created_at then
    raise exception 'A message can be hidden, but never rewritten.';
  end if;
  if new.hidden_at is not null and old.hidden_at is null then
    new.hidden_by := coalesce(new.hidden_by, (select auth.uid()));
  elsif new.hidden_at is null then
    new.hidden_by := null;
  end if;
  return new;
end $$;

create trigger messages_guard before update on public.messages
  for each row execute function public.enforce_message_guard();

create function public.notify_message_moderated() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.hidden_at is not null and old.hidden_at is null then
    insert into public.audit_log (actor_id, action, target_kind, target_id, detail)
    values ((select auth.uid()), 'hide_message', 'message', new.id,
            jsonb_build_object('request_id', new.request_id, 'sender_id', new.sender_id));
  elsif new.hidden_at is null and old.hidden_at is not null then
    insert into public.audit_log (actor_id, action, target_kind, target_id, detail)
    values ((select auth.uid()), 'unhide_message', 'message', new.id,
            jsonb_build_object('request_id', new.request_id, 'sender_id', new.sender_id));
  end if;
  return new;
end $$;

create trigger messages_notify_moderated after update on public.messages
  for each row execute function public.notify_message_moderated();

revoke execute on function public.enforce_message_guard() from public, anon, authenticated;
revoke execute on function public.notify_message_moderated() from public, anon, authenticated;

notify pgrst, 'reload schema';
