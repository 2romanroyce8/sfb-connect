-- Self-serve SFB Agent subscriptions started from the public /agent page.
-- Stripe is the authority: a row is 'pending' until checkout.session.completed
-- arrives, then 'provisioned' once the customer account + business exist.
create table if not exists public.agent_plan_orders (
  id uuid primary key default gen_random_uuid(),
  plan_key text not null check (plan_key in ('agent_starter','agent_growth','agent_scale')),
  email text not null,
  business_name text,
  stripe_checkout_session_id text unique,
  stripe_customer_id text,
  stripe_subscription_id text,
  amount_total_cents integer,
  status text not null default 'pending' check (status in ('pending','paid','provisioned','canceled','failed')),
  business_id uuid references public.businesses(id) on delete set null,
  error text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  provisioned_at timestamptz
);
create index if not exists agent_plan_orders_sub_idx on public.agent_plan_orders(stripe_subscription_id);
alter table public.agent_plan_orders enable row level security;
drop policy if exists agent_plan_orders_owner_read on public.agent_plan_orders;
create policy agent_plan_orders_owner_read on public.agent_plan_orders for select to authenticated using (is_team_owner());
