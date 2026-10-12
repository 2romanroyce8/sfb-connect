-- Kill the trial; gated funnel (Roman, 2026-10-12 01:40 ET).
-- account → email code → build show → pricing → pay. No business row exists
-- before payment. funnel_signups holds the verified identity + confirmed
-- profile; checkout references it so provisioning builds the real business.

create table if not exists public.funnel_signups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null,
  name text not null,
  phone text not null,
  website text not null,
  domain text not null,
  build_id uuid references public.demo_builds(id) on delete set null,
  profile jsonb,
  email_verified_at timestamptz,
  pricing_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists funnel_signups_email_idx on public.funnel_signups(email);
alter table public.funnel_signups enable row level security; -- service role only
drop trigger if exists funnel_signups_touch on public.funnel_signups;
create trigger funnel_signups_touch before update on public.funnel_signups for each row execute function public.touch_updated_at();

alter table public.agent_plan_orders add column if not exists signup_id uuid references public.funnel_signups(id) on delete set null;

-- Trial rows. Stock-data sandbox demos are deleted (nothing real in them).
-- Real-looking signups keep their account and become "no plan" so they land
-- on the pricing step of the new funnel (listed for Roman as leads).
delete from public.businesses where plan_key = 'trial' and is_sandbox = true;
update public.businesses set plan_key = null, monthly_credit_allotment = 0, trial_expires_at = null, updated_at = now() where plan_key = 'trial';
