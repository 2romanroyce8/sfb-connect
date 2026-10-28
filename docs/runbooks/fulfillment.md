# Runbook — Fulfillment and ordering (/app/orders)
- Tables (applied 2026-10-28, additive): agy_services (15 platform services seeded, NO prices; agencies can add their own), agy_orders, agy_order_tasks, agy_order_events. RLS + least-privilege. Orders carry the agency's own cost and retail price (cents); clients have NO access to orders (so costs and margins are never exposed to a client user).
- Status path: draft → quoted → awaiting approval → onboarding → in development → QA → client review → live → maintenance (+ canceled, final). One step forward or back at a time (lib/agency/orders.ts, tested). Gates re-checked on the server: a quote needs a retail price; development/QA/review/live need the client's onboarding APPROVED.
- Orders are canceled, never deleted; history is append-only; task toggles are logged. Creating an order seeds 6 default tasks.
- Margin: computed from the numbers the agency types (profit and percent of retail; no retail price shows no percent, never 0%). No wholesale price list exists in the platform; do not seed one without Roman's confirmed numbers.
- Fulfillment is MANUAL: nothing here contacts a vendor, a client or a payment provider. Billing the client for an order is a separate step (Stripe Connect, not live).
- Not built yet: assigning an order to a teammate, client-visible order progress in the portal, order-level invoices.
