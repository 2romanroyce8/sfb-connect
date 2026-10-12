-- Google connection "never blocked" gate (Roman, 2026-10-12).
-- The Google Cloud OAuth app stays in TESTING MODE on purpose (bridge strategy
-- until revenue funds verification). Testing mode admits only listed test
-- users (cap 100), so a customer's Connect button exists only once the team
-- has added their address to the tester list. These tables are OUR record of
-- that list — Google exposes no API for it.

create table if not exists public.google_clearances (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  email text not null,                                   -- the Google account the customer will connect with (lowercased)
  status text not null default 'email_submitted' check (status in ('not_started','email_submitted','cleared','connected')),
  submitted_at timestamptz not null default now(),
  cleared_at timestamptz,
  cleared_by uuid references public.users(id) on delete set null,
  connected_at timestamptz,
  denied_count integer not null default 0,               -- access_denied callbacks seen for this business (backstop fired)
  last_denied_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.google_clearances enable row level security;
drop policy if exists google_clearances_owner_select on public.google_clearances;
create policy google_clearances_owner_select on public.google_clearances for select to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));
drop policy if exists google_clearances_team_select on public.google_clearances;
create policy google_clearances_team_select on public.google_clearances for select using (is_team_owner());
-- writes: service role via the gate API after an ownership / team check.

-- Backstop + audit: every gate event (submitted, cleared, connected, access_denied, threshold alerts).
create table if not exists public.google_gate_events (
  id bigint generated always as identity primary key,
  business_id uuid references public.businesses(id) on delete set null,
  email text,
  event text not null check (event in ('email_submitted','cleared','connected','access_denied','threshold_alert','verification_task_created','clearances_blocked')),
  detail jsonb,
  created_at timestamptz not null default now()
);
create index if not exists google_gate_events_idx on public.google_gate_events (event, created_at desc);
alter table public.google_gate_events enable row level security;
drop policy if exists google_gate_events_team_select on public.google_gate_events;
create policy google_gate_events_team_select on public.google_gate_events for select using (is_team_owner());

-- One-row state: which threshold alerts already fired, whether the verification task exists, whether new clearances are blocked.
create table if not exists public.google_gate_state (
  id integer primary key default 1 check (id = 1),
  alerts_fired jsonb not null default '[]'::jsonb,         -- e.g. [70, 85, 95]
  verification_task_id uuid,
  verification_task_created_at timestamptz,
  clearances_blocked boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.google_gate_state (id) values (1) on conflict (id) do nothing;
alter table public.google_gate_state enable row level security;
drop policy if exists google_gate_state_team_select on public.google_gate_state;
create policy google_gate_state_team_select on public.google_gate_state for select using (is_team_owner());

-- In-app notification type for gate events.
do $$
declare c text;
begin
  select conname into c from pg_constraint where conrelid = 'public.crm_notifications'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%lead_assigned%';
  if c is not null then execute format('alter table public.crm_notifications drop constraint %I', c); end if;
  alter table public.crm_notifications add constraint crm_notifications_type_check check (type in (
    'lead_assigned','research_complete','follow_up_due','follow_up_overdue','meeting_booked','meeting_soon','meeting_rescheduled','meeting_cancelled',
    'owner_task_assigned','calendar_mention','script_ready','quiz_required','sop_required','booking_sync_failed','system',
    'lead_new','callback_sla','credits_warning','approval_pending','sms_test','google_gate'));
end $$;
