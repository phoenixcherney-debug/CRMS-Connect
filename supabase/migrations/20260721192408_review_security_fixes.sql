-- ============================================================================
-- Security & trust hardening from the whole-app review.
--
-- 1. Members can no longer enumerate the whole student body — a member sees a
--    student's profile only once that student has raised a hand on one of the
--    member's offers.
-- 2. Members can no longer rewrite their own trust badge (affiliation /
--    class_year are now locked to staff, like role/status already were).
-- 3. A disabled account loses all thread access: requests/messages require an
--    active viewer, messaging into a thread with a disabled counterparty is
--    blocked, and push is never dispatched to a disabled recipient.
-- 4. Students activate only after their email is actually confirmed, not on an
--    unverified @crms.org string at signup.
-- 5. (Blocker) A disabled member's offers leave the open board, while students
--    who already applied keep visibility of the offer for their existing thread.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER → bypass RLS, no policy recursion)
-- ----------------------------------------------------------------------------
create function public.app_user_active(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = p_id and account_status = 'active')
$$;

-- True when the current user is the poster of an offer the given student has
-- raised a hand on — i.e. this member is allowed to see that student.
create function public.app_has_request_from(p_student uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.requests r
    join public.offers o on o.id = r.offer_id
    where r.student_id = p_student and o.posted_by = (select auth.uid())
  )
$$;

-- True when the current user (a student) has a request on the given offer.
create function public.app_has_request_on_offer(p_offer uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.requests
    where offer_id = p_offer and student_id = (select auth.uid())
  )
$$;

revoke execute on function public.app_user_active(uuid) from public, anon;
revoke execute on function public.app_has_request_from(uuid) from public, anon;
revoke execute on function public.app_has_request_on_offer(uuid) from public, anon;
grant execute on function public.app_user_active(uuid) to authenticated;
grant execute on function public.app_has_request_from(uuid) to authenticated;
grant execute on function public.app_has_request_on_offer(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 1. profiles_select — no student directory for members
-- ----------------------------------------------------------------------------
drop policy profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or public.app_is_admin()
    or (
      public.app_is_active()
      and account_status = 'active'
      and (
        -- Members and staff are the public-facing side, visible to any active user.
        role in ('member', 'admin')
        -- A student is visible only to a member who has a request from them.
        or public.app_has_request_from(id)
      )
    )
  );

-- ----------------------------------------------------------------------------
-- 2. enforce_profile_guard — lock affiliation & class_year too
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

-- ----------------------------------------------------------------------------
-- 3. Disabled accounts lose thread access
-- ----------------------------------------------------------------------------
drop policy requests_select on public.requests;
create policy requests_select on public.requests for select to authenticated
  using (
    public.app_is_admin()
    or (
      public.app_is_active()
      and (
        student_id = (select auth.uid())
        or exists (select 1 from public.offers o
                   where o.id = offer_id and o.posted_by = (select auth.uid()))
      )
    )
  );

drop policy requests_update on public.requests;
create policy requests_update on public.requests for update to authenticated
  using (
    public.app_is_admin()
    or (
      public.app_is_active()
      and (
        student_id = (select auth.uid())
        or exists (select 1 from public.offers o
                   where o.id = offer_id and o.posted_by = (select auth.uid()))
      )
    )
  )
  with check (
    public.app_is_admin()
    or (
      public.app_is_active()
      and (
        student_id = (select auth.uid())
        or exists (select 1 from public.offers o
                   where o.id = offer_id and o.posted_by = (select auth.uid()))
      )
    )
  );

drop policy messages_select on public.messages;
create policy messages_select on public.messages for select to authenticated
  using (
    public.app_is_admin()
    or (
      public.app_is_active()
      and hidden_at is null
      and exists (
        select 1 from public.requests r
        join public.offers o on o.id = r.offer_id
        where r.id = request_id
          and (r.student_id = (select auth.uid()) or o.posted_by = (select auth.uid()))
      )
    )
  );

drop policy messages_insert on public.messages;
create policy messages_insert on public.messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.app_is_active()
    and exists (
      select 1 from public.requests r
      join public.offers o on o.id = r.offer_id
      where r.id = request_id
        and r.status in ('sent', 'in_conversation', 'accepted')
        and (
          public.app_is_admin()
          or (
            (r.student_id = (select auth.uid()) or o.posted_by = (select auth.uid()))
            -- Can't message into a thread whose counterparty has been disabled.
            and public.app_user_active(r.student_id)
            and public.app_user_active(o.posted_by)
          )
        )
    )
  );

-- Never dispatch push to a disabled (banned) recipient's devices.
create or replace function public.dispatch_push() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_endpoint text;
  v_secret text;
begin
  if not public.app_user_active(new.user_id) then
    return new;
  end if;
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

-- ----------------------------------------------------------------------------
-- 4. Students activate only after real email confirmation
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
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
  -- Trust the school email only once it's actually confirmed. If confirmation
  -- is disabled in the project, email_confirmed_at is already set here, so this
  -- still activates immediately; if enabled, the on-confirm trigger promotes.
  v_status := case
    when v_role = 'student' and new.email ilike '%@crms.org' and new.email_confirmed_at is not null
      then 'active'::public.account_status
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

-- When GoTrue confirms a school-email student, promote them to active. Runs in
-- the auth server's session (auth.uid() is null), so the profile guard's
-- non-admin lock doesn't apply.
create function public.handle_email_confirmed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email_confirmed_at is not null and old.email_confirmed_at is null
     and new.email ilike '%@crms.org' then
    update public.profiles
    set account_status = 'active', approved_at = coalesce(approved_at, now())
    where id = new.id and role = 'student' and account_status = 'pending';
  end if;
  return new;
end $$;

create trigger on_auth_user_confirmed
  after update on auth.users
  for each row execute function public.handle_email_confirmed();

-- ----------------------------------------------------------------------------
-- 5. (Blocker) Disabled members' offers leave the open board
-- ----------------------------------------------------------------------------
drop policy offers_select on public.offers;
create policy offers_select on public.offers for select to authenticated
  using (
    public.app_is_admin()
    or posted_by = (select auth.uid())
    or (
      public.app_is_active()
      and status <> 'draft'
      and hidden_at is null
      and (
        -- Poster still active → shown on the board.
        public.app_user_active(posted_by)
        -- Poster disabled but this student already applied → keep the offer
        -- visible so their existing thread/requests still resolve.
        or public.app_has_request_on_offer(id)
      )
    )
  );

notify pgrst, 'reload schema';
