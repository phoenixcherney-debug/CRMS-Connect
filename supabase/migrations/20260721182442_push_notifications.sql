-- ============================================================================
-- Opt-in web push (see SPEC.md — notifications are in-app first; push is an
-- explicit per-device opt-in, never on by default).
--
-- Flow: a `notifications` row is inserted by an existing trigger → the
-- `dispatch_push` trigger here fires the `send-push` edge function via pg_net,
-- but ONLY for users who have a push subscription. The edge function signs the
-- payload with VAPID and delivers it to the browser's push service.
--
-- Secrets (VAPID keys, hook secret) live in the edge function env + Vault, not
-- in this file. Until they're set, `dispatch_push` no-ops safely.
-- ============================================================================

create extension if not exists pg_net;

-- ----------------------------------------------------------------------------
-- Subscriptions: one row per browser/device a user has opted in on.
-- ----------------------------------------------------------------------------
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text check (user_agent is null or char_length(user_agent) <= 400),
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- A user only ever touches their own subscriptions. The edge function reads
-- across users via the service role (which bypasses RLS).
create policy push_sub_select on public.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));
create policy push_sub_insert on public.push_subscriptions for insert to authenticated
  with check (user_id = (select auth.uid()) and public.app_is_active());
create policy push_sub_update on public.push_subscriptions for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy push_sub_delete on public.push_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()));

-- ----------------------------------------------------------------------------
-- Config in Vault: the function URL (not secret, kept here so it can change
-- without a migration) and a shared hook secret the trigger presents to the
-- edge function. The secret is generated in-DB and never printed; the project
-- owner reads it back from vault.decrypted_secrets to set it on the function.
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'push_endpoint') then
    perform vault.create_secret(
      'https://ebfhjdkonidfjyfhkcyi.supabase.co/functions/v1/send-push',
      'push_endpoint',
      'CRMS Connect: send-push edge function URL'
    );
  end if;
  if not exists (select 1 from vault.secrets where name = 'push_hook_secret') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(24), 'base64'),
      'push_hook_secret',
      'CRMS Connect: shared secret between the notifications trigger and send-push'
    );
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- Dispatch trigger: fire-and-forget push for opted-in users. Wrapped so a
-- push failure can never block or roll back the notification insert.
-- ----------------------------------------------------------------------------
create function public.dispatch_push() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_endpoint text;
  v_secret text;
begin
  -- Skip the HTTP call entirely for users who haven't opted in.
  if not exists (select 1 from public.push_subscriptions where user_id = new.user_id) then
    return new;
  end if;

  select decrypted_secret into v_endpoint from vault.decrypted_secrets where name = 'push_endpoint';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_hook_secret';
  if v_endpoint is null or v_secret is null then
    return new;
  end if;

  perform net.http_post(
    url := v_endpoint,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body := jsonb_build_object(
      'user_id', new.user_id,
      'title', new.title,
      'body', new.body,
      'link', new.link
    )
  );
  return new;
exception when others then
  return new;
end $$;

revoke execute on function public.dispatch_push() from public, anon, authenticated;

create trigger notifications_dispatch_push
  after insert on public.notifications
  for each row execute function public.dispatch_push();

notify pgrst, 'reload schema';
