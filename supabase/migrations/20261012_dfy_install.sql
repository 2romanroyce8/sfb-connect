-- O3 (Roman, 2026-10-12): the done-for-you install offered at onboarding step 9.
-- $8,000 one-time — Rome's number, cleared. The Stripe Price is created by lookup key
-- (lib/billing/dfy.ts) the first time checkout runs, same pattern as the agent tiers.
insert into public.addon_products (key, name, category, description, best_for, billing_type, unit, base_price_cents, plan_eligibility, active, featured, sort_order)
values ('dfy_install', 'Done-for-you install', 'HUMAN_SERVICES', 'We set everything up and run your agent for the first 90 days: connections, ICP, lead list, sequences, first campaigns, weekly check-ins.', 'Owners who want results without running the dashboard themselves.', 'one_time', 'flat', 800000, '["solo","agency"]'::jsonb, true, true, 5)
on conflict (key) do update set base_price_cents = excluded.base_price_cents, name = excluded.name, description = excluded.description, active = true, updated_at = now();
