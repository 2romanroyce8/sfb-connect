# Runbook — Pricing page (`/pricing`) and annual billing

Built 2026-10-10 from Roman's "SFB Pricing Page Overhaul" spec. Goal: a 5-year-old leaves knowing what it costs (one-time build + monthly fuel), how it saves time, saves money, makes money.

## Single source of truth
Every figure on `/pricing`, the homepage `#pricing` section, `/agent`, checkout and the ledger comes from **`lib/agentProgram/config.ts`**. Derived copy/math lives in **`lib/agentProgram/pricing.ts`** (offer text with numbers substituted, price display per interval, ROI math, FAQ). Change a number in config → it changes everywhere; `tests/lib/pricing.test.ts` pins the ground truth.

| Thing | Where |
|---|---|
| Tiers, credits, setup fees, trial days | `TIERS` |
| Annual multiplier (10× monthly = 2 months free) | `ANNUAL_MONTHS_CHARGED`, `annualUsd`, `annualPerMonthUsd` |
| Niche multipliers (roofing shown; clinics ×1.5; PE ×3.0 by consultation) | `NICHES` |
| Top-ups | `TOP_UP_PACKS` |
| Per-action credit prices, free actions, guards | `CREDIT_PRICES`, `FREE_ACTIONS`, `WARN_AT`, `CREDITS_PAY_FOR_WORK` |
| 1 call ≈ 15 credits | `CREDITS_PER_BOOKED_CALL` |
| **BLANKS (Rome only)** | `ANCHOR_WAS_USD`, `REPLACED_VENDORS[].monthlyUsd`, `VENDORS_TOTAL_MONTHLY_USD` |

### Filling Rome's blanks
- **Anchor "was" prices:** set `ANCHOR_WAS_USD.solo` / `.agency` (monthly USD). Until set: no strikethrough, no "Launch pricing" tag. The test refuses a "was" price lower than the live price.
- **Six-vendor total:** set `VENDORS_TOTAL_MONTHLY_USD` (and optionally each vendor's `monthlyUsd`). Until set the page says "Typically thousands a month" — the wording Rome offered as the fallback.
- **Trial length:** `TIERS.trial.trialDays` (+ `expiry` label). Set to **14** (Roman confirmed 2026-10-10 afternoon).

## Page structure (`app/pricing/page.tsx`)
1. `HowItWorks` — "One build. One monthly. That's it." (3 steps)
2. `PricingTiers` — Monthly | Annual toggle; Trial/Solo/Agency cards; includes list; THE OFFER block (Problem / Saves TIME / Saves MONEY / Makes MONEY); CTA (trial → `/start`, paid → `AgentCheckout` with `interval`)
3. `RoiCalculator` — customer value + close % + plan → `roiEstimate()`; inputs start empty; nothing renders until both are valid
4. `CreditPriceList` — all `CREDIT_PRICES` grouped by capability + human overseer, free actions, guards, top-ups
5. `VendorGrid` — "Fire six vendors. Keep one agent." vs Solo
6. `PricingFaq` — 5 point-of-doubt questions (copy reused from Atlas's AGENT_FAQ, the §1 setup step, and Terms "export your data within 30 days")

Nav + footer "Pricing" → `/pricing`; homepage `#pricing` keeps the glass cards and links to the full page; `/pricing` is in the sitemap. Events: `pricing_billing_toggle`, `pricing_card_click {tier, interval}`, `roi_calculated`, `pricing_faq_open` (allowlisted in `/api/marketing-events`).

## Annual billing (how it really works)
- Checkout: `POST /api/agent/checkout { plan, email, businessName, interval: "month"|"year" }`. Annual uses Stripe price `sfb_agent_<tier>_annual` (10× monthly, `recurring.interval=year`), created on first use like the monthly one. Setup fee line item is identical on both intervals. `agent_plan_orders.billing_interval` and the Stripe metadata record the choice.
- Provisioning is unchanged (`provisionAgentCustomer`): first month of credits granted on `checkout.session.completed`.
- **Monthly refill on annual plans:** Stripe only sends `invoice.paid` once a year, so the daily pg_cron job **`billing-plan-refill-daily`** (06:30 UTC) POSTs `/api/cron/plan-refill` with a Vault-held bearer token (`billing_cron_settings.cron_token_hash` = its SHA-256). `refillAnnualPlans()` expires the unspent allotment and grants `tier.credits` to every provisioned annual business whose `credits_cycle_started_at` is ≥ 1 month old. Idempotent per business per calendar month (`annual_refill:<business>:<YYYY-MM>`). Result stored in `billing_cron_settings.last_run_at / last_result`.
- Yearly `invoice.paid` (`billing_reason=subscription_cycle`) still runs `grantAgentRenewalCredits` — that is the month-13 grant; harmless overlap is prevented by the cycle reset.

### Operate
- Check it ran: `select last_run_at, last_result from billing_cron_settings;` and `select * from cron.job where jobname='billing-plan-refill-daily';`
- Pause: `update billing_cron_settings set enabled=false; select billing_cron_schedule();`
- Rotate token: `select billing_cron_rotate_token();` (re-schedules automatically)
- Run by hand: `select billing_cron_rotate_token();` then trigger via SQL `select cron.run_job(...)`, or set `CRON_SECRET` in Vercel and `curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://www.sfbconnect.com/api/cron/plan-refill`.
- Migration: `supabase/migrations/20261010_annual_billing.sql` (applied 2026-10-10).

## Failure modes
- Annual customer not refilled → check `agent_plan_orders.billing_interval='year'` + `status='provisioned'`, `businesses.credits_cycle_started_at`, then `billing_cron_settings.last_result`.
- Card shows no "Launch pricing" tag → `ANCHOR_WAS_USD` is null (expected until Rome supplies).
- Checkout 409 → Stripe keys missing; 500 with `[stripe …]` hint → bad key (see checkout.md).

## Not yet
Niche-priced checkout (clinics/PE are consultation-only by design), proration between intervals, plan changes.
