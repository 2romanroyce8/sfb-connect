# Runbook — SFB Agent product (tiers, capabilities, trial)

**Single source of truth:** `lib/agentProgram/config.ts` — the 8 capabilities, tiers (Trial/Solo/Agency), every per-action credit price, top-up packs, planning math, guards thresholds, stock trial profiles, FAQ. Change a number there and the public page, checkout, ledger guards and dashboard all follow. Capability **statuses** (live / unlocking next / roadmap) live in `agent_program_modules` and are edited at `/team/settings` → "SFB Agent program".

## Surfaces
- Public: `/agent` (hero, how it works, 8 capability cards with statuses, integrations row, credits + price list + planning math + top-ups, human overseer, pricing with "Everything in X, plus…", 10-question FAQ, risk-reversal strip). Presence plans at `/#pricing` stay the downsell wedge.
- Trial: `/start` → `POST /api/trial/start` → account (password set, email confirmed), sandbox business on a stock profile (`businesses.is_sandbox=true`, `stock_profile_key`), 128 PROMOTIONAL credits, 3 capabilities enabled, `trial_expires_at = now + 14d`. No Stripe. Rate-limited 5/IP/day.
- Customer: `/dashboard/agent` (status strip, credit bar with 80/95% colors, 8 toggle cards with per-card spend, activity feed with Done / Failed · 0 credits / Credits added), `/dashboard/credits` (balance, allotment, refill/expiry, planning calculator, top-up packs with Stripe buy buttons on paid tiers, full ledger, CSV export at `/api/dashboard/credits/export`). Trial mode: DEMO banner + Go live button, price list hidden, packs replaced by upgrade card.
- Toggles: `PATCH /api/dashboard/capabilities {capability, enabled}` — free; trial enforces the 3-capability limit (409 with message).
- Team: overseer assignment on `/team/team`; module statuses in Settings.

## Data
- `businesses`: `plan_key` (trial|solo|agency|revenue_*), `is_sandbox`, `stock_profile_key`, `trial_expires_at`, `monthly_credit_allotment`, `credits_cycle_started_at`, `work_paused_reason`, `agent_overseer_id`.
- `business_capabilities (business_id, capability_key, enabled)` — RLS: owner read/write, team read.
- `credit_transactions` gained `capability_key`, `action_key` (per-card spend, receipts).
- `agent_plan_orders` — checkout → provisioning trail.

## Operating
- Flip a capability to live: Settings → SFB Agent program (no deploy).
- Change a price: edit `CREDIT_PRICES` in config, run tests (`tests/lib/agentProgram.test.ts` pins the published table), deploy. Tell customers before new work is charged (FAQ promise).
- Trial abuse: rate limit per IP in `/api/trial/start`; `billing_audit_log` has `trial_started` rows.
- Expired trials / zero credits: the dashboard shows the paywall; `work_paused_reason` is set by the guards when a charge is refused.

## Not built yet (disclosed)
Steps 4–5 of both onboarding flows (live "watch the agent work" feed and "approve first 3 tasks") depend on the agent runner producing real tasks — see the task queue + research adapters. Reports/Integrations tabs for the agent product, Agency's 5 client spaces, 80% warning **email** (banner is live; email needs a provider), overseer-signed PDF reports.
