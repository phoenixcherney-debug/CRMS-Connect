-- ============================================================
-- CRMS Connect — Personal Availability Calendar
-- Drops the bookings table and old availability_slots table,
-- replaces them with a new private availability_slots table.
-- ============================================================

-- Drop old tables (cascade drops any dependent policies/constraints)
drop table if exists bookings cascade;
drop table if exists availability_slots cascade;

-- ─── New availability_slots table ────────────────────────────────────────────
create table availability_slots (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references auth.users(id) on delete cascade not null,
  title               text,
  date                date not null,
  start_time          time not null,
  end_time            time not null,
  is_recurring        boolean default false not null,
  recurrence_pattern  text check (recurrence_pattern in ('daily', 'weekly', 'monthly')),
  recurrence_end_date date,
  created_at          timestamptz default now(),

  constraint valid_time_range check (end_time > start_time)
);

create index idx_avail_slots_user_id on availability_slots(user_id);
create index idx_avail_slots_date    on availability_slots(date);

-- ─── Row Level Security ───────────────────────────────────────────────────────
alter table availability_slots enable row level security;

-- Only the authenticated owner may read their own slots
create policy "slots_select_own"
  on availability_slots for select
  using (auth.uid() = user_id);

-- Only the authenticated owner may insert their own slots
create policy "slots_insert_own"
  on availability_slots for insert
  with check (auth.uid() = user_id);

-- Only the authenticated owner may update their own slots
create policy "slots_update_own"
  on availability_slots for update
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Only the authenticated owner may delete their own slots
create policy "slots_delete_own"
  on availability_slots for delete
  using (auth.uid() = user_id);
