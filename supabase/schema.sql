-- 任务安排工作台 - Supabase 建表脚本
-- 使用方式：
-- 1. 打开 Supabase Dashboard -> SQL Editor
-- 2. 新建 Query
-- 3. 粘贴本文件全部内容并执行

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'task_priority') then
    create type public.task_priority as enum ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
  end if;

  if not exists (select 1 from pg_type where typname = 'task_status') then
    create type public.task_status as enum (
      'TODO',
      'SCHEDULED',
      'IN_PROGRESS',
      'DONE',
      'OVERDUE',
      'ARCHIVED'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'event_status') then
    create type public.event_status as enum ('CONFIRMED', 'TENTATIVE', 'CANCELLED');
  end if;

  if not exists (select 1 from pg_type where typname = 'event_origin') then
    create type public.event_origin as enum ('LOCAL', 'GOOGLE', 'DINGTALK');
  end if;

  if not exists (select 1 from pg_type where typname = 'connection_provider') then
    create type public.connection_provider as enum ('GOOGLE', 'DINGTALK');
  end if;

  if not exists (select 1 from pg_type where typname = 'connection_status') then
    create type public.connection_status as enum ('ACTIVE', 'EXPIRED', 'REVOKED', 'ERROR');
  end if;

  if not exists (select 1 from pg_type where typname = 'sync_status') then
    create type public.sync_status as enum ('PENDING', 'SUCCESS', 'FAILED', 'CONFLICT');
  end if;

  if not exists (select 1 from pg_type where typname = 'conflict_type') then
    create type public.conflict_type as enum ('TIME_OVERLAP', 'VERSION_CONFLICT', 'DELETED_MISMATCH');
  end if;

  if not exists (select 1 from pg_type where typname = 'resolution_status') then
    create type public.resolution_status as enum ('OPEN', 'RESOLVED', 'IGNORED');
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  name text not null,
  avatar_url text,
  timezone text not null default 'Asia/Shanghai',
  locale text not null default 'zh-CN',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  priority public.task_priority not null default 'MEDIUM',
  status public.task_status not null default 'TODO',
  source text not null default 'local',
  due_at timestamptz,
  estimated_minutes integer,
  tag_names jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.schedule_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  title text not null,
  description text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  all_day boolean not null default false,
  timezone text not null default 'Asia/Shanghai',
  location text,
  reminders jsonb,
  status public.event_status not null default 'CONFIRMED',
  origin public.event_origin not null default 'LOCAL',
  last_modified_by text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  constraint schedule_events_time_check check (end_at >= start_at)
);

create table if not exists public.calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider public.connection_provider not null,
  provider_account_id text not null,
  status public.connection_status not null default 'ACTIVE',
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  scope text,
  meta jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint calendar_connections_user_provider_unique unique (user_id, provider)
);

create table if not exists public.calendars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  connection_id uuid not null references public.calendar_connections(id) on delete cascade,
  provider public.connection_provider not null,
  provider_calendar_id text not null,
  name text not null,
  color text,
  is_primary boolean not null default false,
  is_selected boolean not null default true,
  read_only boolean not null default false,
  sync_enabled boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint calendars_connection_provider_calendar_unique unique (connection_id, provider_calendar_id)
);

create table if not exists public.external_event_bindings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  schedule_event_id uuid not null references public.schedule_events(id) on delete cascade,
  provider public.connection_provider not null,
  calendar_id uuid not null references public.calendars(id) on delete cascade,
  provider_event_id text not null,
  provider_etag text,
  provider_updated_at timestamptz,
  sync_token_snapshot text,
  last_sync_at timestamptz,
  sync_status public.sync_status not null default 'PENDING',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint external_event_bindings_provider_event_unique unique (provider, provider_event_id)
);

create table if not exists public.sync_cursors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider public.connection_provider not null,
  calendar_id uuid not null references public.calendars(id) on delete cascade,
  cursor_type text not null,
  cursor_value text not null,
  expires_at timestamptz,
  meta jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint sync_cursors_calendar_type_unique unique (calendar_id, cursor_type)
);

create table if not exists public.sync_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider public.connection_provider not null,
  direction text not null,
  action text not null,
  resource_type text not null,
  resource_local_id uuid,
  resource_remote_id text,
  status public.sync_status not null,
  error_code text,
  error_message text,
  payload jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.conflict_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  schedule_event_id uuid not null references public.schedule_events(id) on delete cascade,
  conflict_type public.conflict_type not null,
  provider public.connection_provider,
  resolution_status public.resolution_status not null default 'OPEN',
  local_snapshot jsonb,
  remote_snapshot jsonb,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_tasks_user_status on public.tasks(user_id, status);
create index if not exists idx_schedule_events_user_time on public.schedule_events(user_id, start_at, end_at);
create index if not exists idx_calendar_connections_user_provider on public.calendar_connections(user_id, provider);
create index if not exists idx_calendars_user_provider on public.calendars(user_id, provider);
create index if not exists idx_sync_cursors_user_provider on public.sync_cursors(user_id, provider);
create index if not exists idx_sync_logs_user_provider_status on public.sync_logs(user_id, provider, status);
create index if not exists idx_conflict_records_user_status on public.conflict_records(user_id, resolution_status);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists set_tasks_updated_at on public.tasks;
create trigger set_tasks_updated_at
before update on public.tasks
for each row
execute function public.set_updated_at();

drop trigger if exists set_schedule_events_updated_at on public.schedule_events;
create trigger set_schedule_events_updated_at
before update on public.schedule_events
for each row
execute function public.set_updated_at();

drop trigger if exists set_calendar_connections_updated_at on public.calendar_connections;
create trigger set_calendar_connections_updated_at
before update on public.calendar_connections
for each row
execute function public.set_updated_at();

drop trigger if exists set_calendars_updated_at on public.calendars;
create trigger set_calendars_updated_at
before update on public.calendars
for each row
execute function public.set_updated_at();

drop trigger if exists set_external_event_bindings_updated_at on public.external_event_bindings;
create trigger set_external_event_bindings_updated_at
before update on public.external_event_bindings
for each row
execute function public.set_updated_at();

drop trigger if exists set_sync_cursors_updated_at on public.sync_cursors;
create trigger set_sync_cursors_updated_at
before update on public.sync_cursors
for each row
execute function public.set_updated_at();

drop trigger if exists set_conflict_records_updated_at on public.conflict_records;
create trigger set_conflict_records_updated_at
before update on public.conflict_records
for each row
execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, ''), '@', 1), '用户'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.schedule_events enable row level security;
alter table public.calendar_connections enable row level security;
alter table public.calendars enable row level security;
alter table public.external_event_bindings enable row level security;
alter table public.sync_cursors enable row level security;
alter table public.sync_logs enable row level security;
alter table public.conflict_records enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
to authenticated
using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "tasks_own_all" on public.tasks;
create policy "tasks_own_all"
on public.tasks for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "schedule_events_own_all" on public.schedule_events;
create policy "schedule_events_own_all"
on public.schedule_events for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "calendar_connections_own_all" on public.calendar_connections;
create policy "calendar_connections_own_all"
on public.calendar_connections for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "calendars_own_all" on public.calendars;
create policy "calendars_own_all"
on public.calendars for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "external_event_bindings_own_all" on public.external_event_bindings;
create policy "external_event_bindings_own_all"
on public.external_event_bindings for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "sync_cursors_own_all" on public.sync_cursors;
create policy "sync_cursors_own_all"
on public.sync_cursors for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "sync_logs_own_all" on public.sync_logs;
create policy "sync_logs_own_all"
on public.sync_logs for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "conflict_records_own_all" on public.conflict_records;
create policy "conflict_records_own_all"
on public.conflict_records for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
