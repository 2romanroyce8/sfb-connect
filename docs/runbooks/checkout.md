# Runbook — Checkout (Stripe)

## Paths
- **Agent tiers:** `/pricing` (also `/agent#pricing`, homepage `#pricing`) → `POST /api/agent/checkout {plan: solo|agency, email, businessName, interval: month|year}` → Stripe Checkout (mode=subscription; line items = recurring price + one-time onboarding price, found/created by lookup key `sfb_agent_<tier>_monthly` / `_annual` (10× monthly, yearly) / `_onboarding`; see pricing-page.md for the annual monthly-refill cron) → `agent_plan_orders` pending → webhook `checkout.session.completed` (metadata.kind=agent_plan) → `provisionAgentCustomer`: invite/reuse account, business with `plan_key`, all 8 capabilities on, first month credits, audit → `/agent/welcome` tells the customer to watch for the sign-in email.
- **Trial:** no Stripe. `/start`.
- **Top-ups:** `/dashboard/credits` → `POST /api/dashboard/billing/checkout {kind:"credits", creditPackageId}` (existing route; now creates the Stripe price by lookup key `sfb_topup_<credits>` if missing) → webhook grants PURCHASE credits.
- **Presence add-ons:** unchanged (`addon_products`).

## Webhook
`POST /api/webhooks/stripe` — signature verified, idempotent via `stripe_webhook_events`. Events: `checkout.session.completed`, `invoice.paid`, `customer.subscription.updated`, `customer.subscription.deleted`, `charge.refunded`, `invoice.payment_failed`.

## Setup (one-time, Roman)
1. Stripe → Developers → API keys → Secret key → Vercel env `STRIPE_SECRET_KEY`.
2. Stripe → Webhooks → endpoint `https://www.sfbconnect.com/api/webhooks/stripe` with the events above → Signing secret → Vercel env `STRIPE_WEBHOOK_SECRET`.
3. Redeploy. Verify: `POST /api/agent/checkout` returns a `checkoutUrl` (409 `stripe_not_configured` means a key is missing).
Products/prices appear in Stripe automatically on first checkout; nothing to create by hand.

## Failure modes
- 409 "Checkout isn't available right now" → Stripe keys missing.
- Order stuck `paid` with `error` → provisioning failed (e.g. invite email bounced); fix cause, re-send the Stripe event from the dashboard (idempotent).
- Customer paid but no email → check `agent_plan_orders.status`, then Supabase Auth → Users → resend invite.

## Not yet
Proration, plan changes (Solo ↔ Agency), Agency client-space billing.
