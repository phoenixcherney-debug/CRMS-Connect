-- ============================================================================
-- CRMS Connect v2 — full rebuild (see SPEC.md)
--
-- v1 accreted 63 migrations and a surface (DMs, marketplace, follows, feed,
-- meeting slots, push, resumes) the product no longer wants. The database held
-- only disposable test data, so v2 rebuilds the public schema from zero around
-- one loop: members post offers → students raise a hand → they talk in a
-- staff-visible request thread → the member accepts.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Clean slate
-- ----------------------------------------------------------------------------
drop schema if exists public cascade;
create schema public;
comment on schema public is 'CRMS Connect v2';

grant usage on schema public to postgres, anon, authenticated, service_role;
grant create on schema public to postgres, service_role;

-- Restore Supabase's default privileges (dropped with the schema) so PostgREST
-- roles can reach new objects; RLS remains the enforcement layer.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on routines to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

-- v1 test users (and their sessions/identities) go with the schema.
delete from auth.users;

-- ----------------------------------------------------------------------------
-- 2. Enums
-- ----------------------------------------------------------------------------
create type public.user_role as enum ('student', 'member', 'admin');
create type public.member_affiliation as enum ('alumni', 'parent', 'faculty_staff', 'friend');
create type public.account_status as enum ('pending', 'active', 'disabled');
create type public.offer_kind as enum ('internship', 'job', 'shadow_day', 'mentorship', 'project_help', 'career_chat', 'other');
create type public.offer_status as enum ('draft', 'open', 'filled', 'closed');
create type public.location_mode as enum ('in_person', 'remote', 'flexible');
create type public.request_status as enum ('sent', 'in_conversation', 'accepted', 'declined', 'withdrawn');
create type public.report_status as enum ('open', 'resolved', 'dismissed');
create type public.report_target as enum ('user', 'offer', 'message');
create type public.notification_kind as enum ('request_received', 'request_update', 'message_received', 'account_update', 'offer_moderated', 'report_update');

-- ----------------------------------------------------------------------------
-- 3. Tables
-- ----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null,
  account_status public.account_status not null default 'pending',
  full_name text not null check (char_length(full_name) between 1 and 80),
  affiliation public.member_affiliation,
  class_year integer check (class_year between 1950 and 2040),
  title text check (title is null or char_length(title) <= 80),
  organization text check (organization is null or char_length(organization) <= 80),
  location text check (location is null or char_length(location) <= 80),
  bio text check (bio is null or char_length(bio) <= 1000),
  tags text[] not null default '{}' check (coalesce(array_length(tags, 1), 0) <= 10),
  open_to_requests boolean not null default true,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references public.profiles (id) on delete set null,
  constraint member_has_affiliation check (role <> 'member' or affiliation is not null),
  constraint student_has_class_year check (role <> 'student' or class_year is not null)
);
comment on column public.profiles.affiliation is 'Members only: the relationship to CRMS shown next to their name. Students/admins null (except alumni admins).';
comment on column public.profiles.class_year is 'Students: expected graduation year. Alumni: graduation year.';
comment on column public.profiles.open_to_requests is 'Member pause switch: false hides their open offers from the board.';

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  posted_by uuid not null references public.profiles (id) on delete cascade,
  kind public.offer_kind not null,
  title text not null check (char_length(title) between 4 and 90),
  description text not null check (char_length(description) between 1 and 3000),
  location_mode public.location_mode not null default 'in_person',
  location_text text check (location_text is null or char_length(location_text) <= 80),
  timeframe text check (timeframe is null or char_length(timeframe) <= 80),
  commitment text check (commitment is null or char_length(commitment) <= 80),
  spots integer not null default 1 check (spots between 1 and 20),
  status public.offer_status not null default 'open',
  hidden_at timestamptz,
  hidden_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.offers is 'The board. One row per opportunity a member offers to students; can be as small as one shadow day for one student.';

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  note text not null check (char_length(note) between 10 and 1500),
  status public.request_status not null default 'sent',
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (offer_id, student_id)
);
comment on table public.requests is 'A student raising a hand on an offer. The only way student↔member contact ever starts.';

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 3000),
  is_staff boolean not null default false,
  hidden_at timestamptz,
  hidden_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
comment on table public.messages is 'Thread scoped to one request. Student, offer poster, and school staff only — staff can always read.';

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target public.report_target not null,
  target_id uuid not null,
  reason text not null check (char_length(reason) between 3 and 500),
  status public.report_status not null default 'open',
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind public.notification_kind not null,
  title text not null check (char_length(title) <= 120),
  body text check (body is null or char_length(body) <= 300),
  link text check (link is null or char_length(link) <= 200),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
comment on table public.notifications is 'In-app only. Rows are written exclusively by SECURITY DEFINER triggers.';

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_kind text,
  target_id uuid,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Indexes ---------------------------------------------------------------------
create index offers_board_idx on public.offers (status, created_at desc);
create index offers_posted_by_idx on public.offers (posted_by);
create index offers_hidden_by_idx on public.offers (hidden_by);
create index requests_offer_idx on public.requests (offer_id);
create index requests_student_idx on public.requests (student_id);
create index messages_request_idx on public.messages (request_id, created_at);
create index messages_sender_idx on public.messages (sender_id);
create index messages_hidden_by_idx on public.messages (hidden_by);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;
create index reports_status_idx on public.reports (status, created_at desc);
create index reports_reporter_idx on public.reports (reporter_id);
create index reports_resolved_by_idx on public.reports (resolved_by);
create index audit_log_created_idx on public.audit_log (created_at desc);
create index audit_log_actor_idx on public.audit_log (actor_id);
create index profiles_role_status_idx on public.profiles (role, account_status);
create index profiles_approved_by_idx on public.profiles (approved_by);

-- ----------------------------------------------------------------------------
-- 4. Helper functions (SECURITY DEFINER bypasses RLS → no policy recursion)
-- ----------------------------------------------------------------------------
create function public.app_role() returns public.user_role
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = (select auth.uid())
$$;

create function public.app_is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin' and account_status = 'active'
  )
$$;

create function public.app_is_active() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and account_status = 'active'
  )
$$;

-- New auth signups → profile. Role/affiliation come from signup metadata; the
-- 'admin' role can never be claimed here. Students with a school email are
-- trusted immediately; every adult waits for staff approval.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_role public.user_role;
  v_affiliation public.member_affiliation;
  v_class_year integer;
  v_status public.account_status;
begin
  v_role := case when meta ->> 'role' = 'member' then 'member'::public.user_role
                 else 'student'::public.user_role end;
  v_affiliation := case
    when v_role <> 'member' then null
    when meta ->> 'affiliation' in ('alumni', 'parent', 'faculty_staff', 'friend')
      then (meta ->> 'affiliation')::public.member_affiliation
    else 'friend'::public.member_affiliation
  end;
  v_class_year := nullif(meta ->> 'class_year', '')::integer;
  if v_role = 'student' and v_class_year is null then
    v_class_year := extract(year from now())::integer + 1;
  end if;
  v_status := case
    when v_role = 'student' and new.email ilike '%@crms.org' then 'active'::public.account_status
    else 'pending'::public.account_status
  end;

  insert into public.profiles (id, role, account_status, full_name, affiliation, class_year, organization, title)
  values (
    new.id,
    v_role,
    v_status,
    coalesce(nullif(trim(meta ->> 'full_name'), ''), split_part(new.email, '@', 1)),
    v_affiliation,
    v_class_year,
    nullif(trim(meta ->> 'organization'), ''),
    nullif(trim(meta ->> 'title'), '')
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger offers_touch before update on public.offers
  for each row execute function public.touch_updated_at();
create trigger requests_touch before update on public.requests
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- 5. Guard triggers (defense in depth beyond RLS)
-- ----------------------------------------------------------------------------

-- Profiles: nobody edits their own trust fields; admins may approve/disable and
-- fix student/member role mix-ups, but the admin role itself is SQL-only.
create function public.enforce_profile_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is not null then
    if not public.app_is_admin() then
      if new.role is distinct from old.role
         or new.account_status is distinct from old.account_status
         or new.approved_at is distinct from old.approved_at
         or new.approved_by is distinct from old.approved_by then
        raise exception 'These fields can only be changed by CRMS staff.';
      end if;
    elsif new.role = 'admin' and old.role <> 'admin' then
      raise exception 'Admin accounts are provisioned directly in SQL, not through the app.';
    end if;
  end if;
  if new.account_status = 'active' and old.account_status = 'pending' then
    new.approved_at := coalesce(new.approved_at, now());
    new.approved_by := coalesce(new.approved_by, (select auth.uid()));
  end if;
  return new;
end $$;

create trigger profiles_guard before update on public.profiles
  for each row execute function public.enforce_profile_guard();

-- Offers: moderation fields are staff-only; ownership can never move.
create function public.enforce_offer_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is not null and not public.app_is_admin() then
    if new.hidden_at is distinct from old.hidden_at
       or new.hidden_by is distinct from old.hidden_by
       or new.posted_by is distinct from old.posted_by then
      raise exception 'Only CRMS staff can change these fields.';
    end if;
  end if;
  if new.hidden_at is not null and old.hidden_at is null then
    new.hidden_by := coalesce(new.hidden_by, (select auth.uid()));
  elsif new.hidden_at is null then
    new.hidden_by := null;
  end if;
  return new;
end $$;

create trigger offers_guard before update on public.offers
  for each row execute function public.enforce_offer_guard();

-- Requests: enforce the status machine per actor.
create function public.enforce_request_transition() returns trigger
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
  if new.note is distinct from old.note
     and not (v_is_student and old.status = 'sent')
     and not public.app_is_admin() then
    raise exception 'The note can only be edited by the student before the conversation starts.';
  end if;

  if new.status is distinct from old.status and v_uid is not null and not public.app_is_admin() then
    if v_is_student then
      if not (old.status in ('sent', 'in_conversation') and new.status = 'withdrawn') then
        raise exception 'Students can only withdraw a pending request.';
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

  if new.status in ('accepted', 'declined', 'withdrawn') and old.status not in ('accepted', 'declined', 'withdrawn') then
    new.decided_at := now();
  end if;
  return new;
end $$;

create trigger requests_transition before update on public.requests
  for each row execute function public.enforce_request_transition();

-- Messages: the staff flag is derived, never client-supplied.
create function public.stamp_message_sender() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.is_staff := public.app_is_admin();
  return new;
end $$;

create trigger messages_stamp before insert on public.messages
  for each row execute function public.stamp_message_sender();

-- Reports: stamp resolution metadata when staff closes one.
create function public.stamp_report_resolution() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status in ('resolved', 'dismissed') and old.status = 'open' then
    new.resolved_at := coalesce(new.resolved_at, now());
    new.resolved_by := coalesce(new.resolved_by, (select auth.uid()));
  end if;
  return new;
end $$;

create trigger reports_stamp before update on public.reports
  for each row execute function public.stamp_report_resolution();

-- ----------------------------------------------------------------------------
-- 6. Notification + audit triggers (run as definer → may write RLS-locked rows)
-- ----------------------------------------------------------------------------
create function public.notify_request_created() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_poster uuid;
  v_offer_title text;
  v_student_name text;
begin
  select o.posted_by, o.title into v_poster, v_offer_title from public.offers o where o.id = new.offer_id;
  select full_name into v_student_name from public.profiles where id = new.student_id;
  insert into public.notifications (user_id, kind, title, body, link)
  values (v_poster, 'request_received', v_student_name || ' raised a hand',
          'On your offer “' || v_offer_title || '”', '/offers/' || new.offer_id || '/manage');
  return new;
end $$;

create trigger requests_notify_created after insert on public.requests
  for each row execute function public.notify_request_created();

create function public.notify_request_updated() returns trigger
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

create trigger requests_notify_updated after update on public.requests
  for each row execute function public.notify_request_updated();

create function public.notify_message_created() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_student uuid;
  v_poster uuid;
  v_sender_name text;
  v_recipient uuid;
begin
  select r.student_id, o.posted_by into v_student, v_poster
  from public.requests r join public.offers o on o.id = r.offer_id
  where r.id = new.request_id;
  select full_name into v_sender_name from public.profiles where id = new.sender_id;

  foreach v_recipient in array array[v_student, v_poster] loop
    if v_recipient <> new.sender_id then
      insert into public.notifications (user_id, kind, title, body, link)
      values (v_recipient, 'message_received',
              case when new.is_staff then 'CRMS staff wrote in your thread'
                   else 'New message from ' || v_sender_name end,
              left(new.body, 140), '/requests/' || new.request_id);
    end if;
  end loop;
  return new;
end $$;

create trigger messages_notify after insert on public.messages
  for each row execute function public.notify_message_created();

create function public.notify_profile_status() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.account_status = 'pending' and new.account_status = 'active' then
    insert into public.notifications (user_id, kind, title, body, link)
    values (new.id, 'account_update', 'You''re in — welcome to CRMS Connect',
            'A staff member approved your account. The board is open.', '/home');
    insert into public.audit_log (actor_id, action, target_kind, target_id)
    values ((select auth.uid()), 'approve_account', 'user', new.id);
  elsif new.account_status = 'disabled' and old.account_status <> 'disabled' then
    insert into public.audit_log (actor_id, action, target_kind, target_id)
    values ((select auth.uid()), 'disable_account', 'user', new.id);
  elsif old.account_status = 'disabled' and new.account_status = 'active' then
    insert into public.audit_log (actor_id, action, target_kind, target_id)
    values ((select auth.uid()), 'reenable_account', 'user', new.id);
  end if;
  return new;
end $$;

create trigger profiles_notify_status after update on public.profiles
  for each row execute function public.notify_profile_status();

create function public.notify_offer_moderated() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.hidden_at is not null and old.hidden_at is null then
    insert into public.notifications (user_id, kind, title, body, link)
    values (new.posted_by, 'offer_moderated', 'A staff member unlisted your offer',
            '“' || new.title || '” is off the board while staff takes a look.', '/home');
    insert into public.audit_log (actor_id, action, target_kind, target_id)
    values ((select auth.uid()), 'hide_offer', 'offer', new.id);
  elsif new.hidden_at is null and old.hidden_at is not null then
    insert into public.audit_log (actor_id, action, target_kind, target_id)
    values ((select auth.uid()), 'unhide_offer', 'offer', new.id);
  end if;
  return new;
end $$;

create trigger offers_notify_moderated after update on public.offers
  for each row execute function public.notify_offer_moderated();

create function public.notify_report_resolved() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status in ('resolved', 'dismissed') and old.status = 'open' then
    insert into public.notifications (user_id, kind, title, body)
    values (new.reporter_id, 'report_update', 'Thanks for flagging',
            'CRMS staff reviewed your report' ||
            case when new.status = 'resolved' then ' and took action.' else '.' end);
    insert into public.audit_log (actor_id, action, target_kind, target_id, detail)
    values ((select auth.uid()), new.status || '_report', 'report', new.id,
            jsonb_build_object('target', new.target, 'target_id', new.target_id));
  end if;
  return new;
end $$;

create trigger reports_notify after update on public.reports
  for each row execute function public.notify_report_resolved();

-- ----------------------------------------------------------------------------
-- 7. RLS
-- ----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.offers enable row level security;
alter table public.requests enable row level security;
alter table public.messages enable row level security;
alter table public.reports enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_log enable row level security;

-- profiles: pending/disabled users see only themselves; active users see the
-- active community; staff sees everyone. Writes: self (guard trigger protects
-- trust fields) or staff.
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or public.app_is_admin()
    or (public.app_is_active() and account_status = 'active')
  );
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid()) or public.app_is_admin())
  with check (id = (select auth.uid()) or public.app_is_admin());

-- offers
create policy offers_select on public.offers for select to authenticated
  using (
    public.app_is_admin()
    or posted_by = (select auth.uid())
    or (public.app_is_active() and status <> 'draft' and hidden_at is null)
  );
create policy offers_insert on public.offers for insert to authenticated
  with check (
    posted_by = (select auth.uid())
    and public.app_is_active()
    and public.app_role() in ('member', 'admin')
  );
create policy offers_update on public.offers for update to authenticated
  using (
    public.app_is_admin()
    or (posted_by = (select auth.uid()) and public.app_is_active() and hidden_at is null)
  )
  with check (
    public.app_is_admin()
    or (posted_by = (select auth.uid()) and public.app_is_active())
  );
create policy offers_delete on public.offers for delete to authenticated
  using (
    public.app_is_admin()
    or (posted_by = (select auth.uid()) and status = 'draft')
  );

-- requests: students start them; only participants and staff ever see them.
create policy requests_select on public.requests for select to authenticated
  using (
    student_id = (select auth.uid())
    or public.app_is_admin()
    or exists (select 1 from public.offers o
               where o.id = offer_id and o.posted_by = (select auth.uid()))
  );
create policy requests_insert on public.requests for insert to authenticated
  with check (
    student_id = (select auth.uid())
    and public.app_role() = 'student'
    and public.app_is_active()
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
create policy requests_update on public.requests for update to authenticated
  using (
    student_id = (select auth.uid())
    or public.app_is_admin()
    or exists (select 1 from public.offers o
               where o.id = offer_id and o.posted_by = (select auth.uid()))
  )
  with check (
    student_id = (select auth.uid())
    or public.app_is_admin()
    or exists (select 1 from public.offers o
               where o.id = offer_id and o.posted_by = (select auth.uid()))
  );

-- messages: thread participants while the door is open; staff always.
create policy messages_select on public.messages for select to authenticated
  using (
    public.app_is_admin()
    or (
      hidden_at is null
      and exists (
        select 1 from public.requests r
        join public.offers o on o.id = r.offer_id
        where r.id = request_id
          and (r.student_id = (select auth.uid()) or o.posted_by = (select auth.uid()))
      )
    )
  );
create policy messages_insert on public.messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.app_is_active()
    and exists (
      select 1 from public.requests r
      join public.offers o on o.id = r.offer_id
      where r.id = request_id
        and r.status in ('sent', 'in_conversation', 'accepted')
        and (r.student_id = (select auth.uid())
             or o.posted_by = (select auth.uid())
             or public.app_is_admin())
    )
  );
create policy messages_update on public.messages for update to authenticated
  using (public.app_is_admin())
  with check (public.app_is_admin());

-- reports
create policy reports_select on public.reports for select to authenticated
  using (reporter_id = (select auth.uid()) or public.app_is_admin());
create policy reports_insert on public.reports for insert to authenticated
  with check (reporter_id = (select auth.uid()) and public.app_is_active());
create policy reports_update on public.reports for update to authenticated
  using (public.app_is_admin())
  with check (public.app_is_admin());

-- notifications: strictly own rows; creation is trigger-only.
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- audit_log: staff-readable, trigger-writable.
create policy audit_select on public.audit_log for select to authenticated
  using (public.app_is_admin());

-- ----------------------------------------------------------------------------
-- 8. RPCs
-- ----------------------------------------------------------------------------
-- Landing-page aggregates. Anon-callable; returns only counts.
create function public.community_stats() returns json
language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'members', (select count(*) from public.profiles where role = 'member' and account_status = 'active'),
    'students', (select count(*) from public.profiles where role = 'student' and account_status = 'active'),
    'offers', (select count(*) from public.offers where status <> 'draft' and hidden_at is null),
    'connections', (select count(*) from public.requests where status = 'accepted')
  )
$$;

create function public.admin_overview() returns json
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.app_is_admin() then
    raise exception 'Staff only.';
  end if;
  return (select json_build_object(
    'pending_members', (select count(*) from public.profiles where account_status = 'pending'),
    'open_reports', (select count(*) from public.reports where status = 'open'),
    'open_offers', (select count(*) from public.offers where status = 'open' and hidden_at is null),
    'hidden_offers', (select count(*) from public.offers where hidden_at is not null),
    'active_students', (select count(*) from public.profiles where role = 'student' and account_status = 'active'),
    'active_members', (select count(*) from public.profiles where role = 'member' and account_status = 'active'),
    'requests_30d', (select count(*) from public.requests where created_at > now() - interval '30 days'),
    'accepted_total', (select count(*) from public.requests where status = 'accepted')
  ));
end $$;

-- ----------------------------------------------------------------------------
-- 9. Function EXECUTE hygiene
-- ----------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.app_role() to authenticated;
grant execute on function public.app_is_admin() to authenticated;
grant execute on function public.app_is_active() to authenticated;
grant execute on function public.admin_overview() to authenticated;
grant execute on function public.community_stats() to anon, authenticated;

notify pgrst, 'reload schema';
