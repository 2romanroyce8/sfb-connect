-- $1 / 5-day trial through Stripe Checkout (2026-10-11).
-- Roman: "stripe is now live make the try free try demo $1 and access is for 5 days".
-- The trial is now an order like any paid plan: /api/trial/start creates the
-- account + a pending agent_plan_orders row (plan_key 'trial', $1 one-time),
-- Stripe Checkout collects the dollar, and the sandbox business is provisioned
-- only once Stripe reports the session paid (webhook, or the success page
-- reading the session from Stripe server-side). `setup` keeps what the wizard
-- chose (stock profile, 3 capabilities, analyzer scan domain) until then.

alter table public.agent_plan_orders drop constraint if exists agent_plan_orders_plan_key_check;
alter table public.agent_plan_orders add constraint agent_plan_orders_plan_key_check
  check (plan_key in ('trial','solo','agency','agent_starter','agent_growth','agent_scale'));

alter table public.agent_plan_orders
  add column if not exists owner_id uuid references auth.users(id) on delete set null,
  add column if not exists setup jsonb not null default '{}'::jsonb,
  add column if not exists stripe_payment_intent_id text;

create index if not exists agent_plan_orders_owner_idx on public.agent_plan_orders(owner_id);
create index if not exists agent_plan_orders_payment_intent_idx on public.agent_plan_orders(stripe_payment_intent_id);
