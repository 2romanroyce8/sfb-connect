-- Post-payment onboarding (Roman, 2026-10-12): thank-you page + 11-step flow.
-- One row per business. Progress saves per step and resumes on login. Step
-- completion is DERIVED from real state wherever real state exists (Gmail
-- connected, calendar connected, prospects present…) — the row only stores
-- what has no other home: per-step inputs, explicit confirmations, the DFY
-- choice, dismissal.

create table if not exists public.customer_onboarding (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  confirmed_steps jsonb not null default '{}'::jsonb,   -- {"1": "2026-10-12T…", "5": "…"} explicit confirmations for steps with no derivable state
  step_data jsonb not null default '{}'::jsonb,         -- {"6": {...draft inputs...}} saved as the user types, so resume lands with inputs intact
  dfy_choice text check (dfy_choice in ('install','retainer_talk','self_serve')),
  dfy_chosen_at timestamptz,
  started_at timestamptz not null default now(),
  dismissed_at timestamptz,                             -- "take me to the dashboard" after the hard gates (2, 3) are passed
  completed_at timestamptz,                             -- reached step 11
  last_step integer not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.customer_onboarding enable row level security;
drop policy if exists customer_onboarding_owner_select on public.customer_onboarding;
create policy customer_onboarding_owner_select on public.customer_onboarding for select to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));
drop policy if exists customer_onboarding_team_select on public.customer_onboarding;
create policy customer_onboarding_team_select on public.customer_onboarding for select using (is_team_owner());
-- writes: service role (the onboarding API), after it has checked the caller owns the business.

-- Step 6 — ideal customer profile: {industry, location, size, notes}
alter table public.businesses add column if not exists icp jsonb;

-- Step 4 — brand assets. Public bucket for logos (served on the dashboard and in outreach signatures).
insert into storage.buckets (id, name, public) values ('brand-assets', 'brand-assets', true) on conflict (id) do nothing;
-- Uploads go through the onboarding API (service role) after an ownership check; no direct client writes.
drop policy if exists brand_assets_public_read on storage.objects;
create policy brand_assets_public_read on storage.objects for select using (bucket_id = 'brand-assets');
