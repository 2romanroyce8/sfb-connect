-- Agent editing help ("make it shorter") — spend log + daily cap (Roman, 2026-10-12).
-- The feature is dark until ANTHROPIC_API_KEY is set in Vercel; this schema is live
-- beforehand so the first call after the key lands is logged with no code change.

-- One row. daily_cap_cents is the only knob: total model spend allowed per
-- America/New_York calendar day across all businesses. When today's logged
-- spend reaches it, the editing buttons are disabled until midnight ET.
create table if not exists public.outbound_assist_settings (
  id smallint primary key default 1 check (id = 1),
  daily_cap_cents integer not null default 500 check (daily_cap_cents >= 0), -- $5.00/day placeholder; Roman sets the real number
  updated_at timestamptz not null default now()
);
insert into public.outbound_assist_settings (id) values (1) on conflict (id) do nothing;
alter table public.outbound_assist_settings enable row level security;
drop policy if exists outbound_assist_settings_owner_read on public.outbound_assist_settings;
create policy outbound_assist_settings_owner_read on public.outbound_assist_settings for select to authenticated using (is_team_owner());

-- Every call to the model, including the ones that failed or were refused by
-- the placeholder guard (tokens were still spent) and the ones blocked by the cap.
create table if not exists public.outbound_assist_calls (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete set null,
  user_id uuid,
  actor_label text,
  instruction text not null,
  model text,
  status text not null check (status in ('ok','error','capped')),
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_cents numeric(10,4) not null default 0,
  error text,
  latency_ms integer,
  created_at timestamptz not null default now()
);
create index if not exists outbound_assist_calls_day on public.outbound_assist_calls(created_at desc);
create index if not exists outbound_assist_calls_business on public.outbound_assist_calls(business_id, created_at desc);
alter table public.outbound_assist_calls enable row level security;
drop policy if exists outbound_assist_calls_owner_read on public.outbound_assist_calls;
create policy outbound_assist_calls_owner_read on public.outbound_assist_calls for select to authenticated using (is_team_owner());

-- Spend per business, for the owners' view.
create or replace view public.outbound_assist_spend_by_business as
  select business_id, count(*) filter (where status = 'ok') as ok_calls, count(*) filter (where status <> 'ok') as other_calls,
         sum(input_tokens) as input_tokens, sum(output_tokens) as output_tokens, round(sum(cost_cents), 4) as cost_cents,
         min(created_at) as first_call_at, max(created_at) as last_call_at
  from public.outbound_assist_calls group by business_id;
