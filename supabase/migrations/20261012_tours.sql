-- Guided tours (Roman, 2026-10-12): reusable, data-driven walkthroughs over the
-- onboarding flow and the dashboard. Per-user state (so "don't show again"
-- and auto-start-once persist) + light analytics with no PII.

create table if not exists public.user_tour_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  tour_key text not null,
  status text not null default 'started' check (status in ('started','completed','skipped')),
  last_step integer not null default 0,
  dont_show boolean not null default false,
  times_started integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key (user_id, tour_key)
);
alter table public.user_tour_state enable row level security;
drop policy if exists user_tour_state_self_select on public.user_tour_state;
create policy user_tour_state_self_select on public.user_tour_state for select using (user_id = auth.uid());
-- writes: the tours API (service role) for the signed-in user only.

-- Analytics: tour started / step viewed / step skipped (missing target) / completed / skipped.
-- No user id, no business id — a random per-run session id is the only key, so drop-off is visible without PII.
create table if not exists public.tour_events (
  id bigint generated always as identity primary key,
  tour_key text not null,
  session_id uuid not null,
  event text not null check (event in ('started','step','step_skipped','completed','skipped','dont_show')),
  step_index integer,
  device text check (device in ('desktop','mobile')),
  created_at timestamptz not null default now()
);
create index if not exists tour_events_tour_idx on public.tour_events (tour_key, created_at desc);
alter table public.tour_events enable row level security;
drop policy if exists tour_events_team_select on public.tour_events;
create policy tour_events_team_select on public.tour_events for select using (is_team_owner());
