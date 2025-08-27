-- Enable UUID if needed (on Supabase it's available)
-- create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  duration_min int not null check (duration_min > 0),
  timezone text not null default 'Asia/Tokyo',
  deadline_at timestamptz,
  organizer_email text,
  created_at timestamptz default now()
);

create table if not exists public.event_slots (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  slot_index int not null default 0,
  meta_json jsonb not null default '{}'::jsonb,
  constraint chk_slot_time check (end_at > start_at)
);

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text,
  email text,
  role text not null default 'member' check (role in ('must','member','optional')),
  invite_token text not null unique,
  invited_at timestamptz default now(),
  last_seen_at timestamptz,
  oauth_provider text,
  oauth_granted boolean default false
);

create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  slot_id uuid not null references public.event_slots(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  choice text not null check (choice in ('yes','maybe','no')),
  comment text,
  updated_at timestamptz default now(),
  unique (slot_id, participant_id)
);

create table if not exists public.decisions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  slot_id uuid not null references public.event_slots(id) on delete cascade,
  decided_by text,
  decided_at timestamptz default now(),
  ics_uid text
);

-- RLS: lock down by default (API routes use service role to operate)
alter table public.events enable row level security;
alter table public.event_slots enable row level security;
alter table public.participants enable row level security;
alter table public.votes enable row level security;
alter table public.decisions enable row level security;

-- Deny all for anon by default
do $$
begin
  if not exists (select 1 from pg_policies where polname = 'deny_all_events') then
    create policy deny_all_events on public.events for all using (false);
  end if;
  if not exists (select 1 from pg_policies where polname = 'deny_all_event_slots') then
    create policy deny_all_event_slots on public.event_slots for all using (false);
  end if;
  if not exists (select 1 from pg_policies where polname = 'deny_all_participants') then
    create policy deny_all_participants on public.participants for all using (false);
  end if;
  if not exists (select 1 from pg_policies where polname = 'deny_all_votes') then
    create policy deny_all_votes on public.votes for all using (false);
  end if;
  if not exists (select 1 from pg_policies where polname = 'deny_all_decisions') then
    create policy deny_all_decisions on public.decisions for all using (false);
  end if;
end $$;
