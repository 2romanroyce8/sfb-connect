-- Book a demo call (2026-10-12). All times stored UTC, displayed Eastern.
create table if not exists public.demo_calls (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text not null,
  website text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  time_zone text not null default 'America/New_York',
  calendar_owner_id uuid references auth.users(id) on delete set null,
  calendar_event_id text,
  html_link text,
  meet_url text,
  call_now boolean not null default false,
  call_now_notified_at timestamptz,
  call_now_notify_result jsonb,
  status text not null default 'scheduled' check (status in ('scheduled','canceled','completed','no_show')),
  source text not null default 'site',
  signup_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists demo_calls_start_idx on public.demo_calls(start_at desc);
alter table public.demo_calls enable row level security;
drop policy if exists demo_calls_team_read on public.demo_calls;
create policy demo_calls_team_read on public.demo_calls for select to authenticated using (public.is_team_member());
