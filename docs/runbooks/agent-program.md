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

## "Your Agent's First 7 Days" analyzer (2026-10-10)
Homepage form (Hero, unchanged copy) → `POST /api/analyze/first-7-days {query}` → NDJSON stream → `components/home/FirstSevenDays.tsx` inside `ScoreSection` (right under the hero).
- **Checks** (`lib/analyzer/checks.ts`, all public data, all in parallel, none throw): presence (existing `business-lookup` edge function: score + gaps/missing = "listing errors"), outbound (Exa, ICP preset per category in `lib/analyzer/icp.ts`, distinct domains across 3 searches = first-pass prospect count), reviews (Google Places only if `GOOGLE_PLACES_API_KEY` is set — otherwise an honest "couldn't read" row; unanswered count is never claimable from the public API), website (our own fetch: first-byte time, HTML weight, title/meta/H1/viewport/schema/tel/booking → top 3 fixes), chat (widget vendor detection; after-hours behaviour is stated as not observable).
- **Honesty rules in code**: `lib/analyzer/narrate.ts` — the "your agent…" line reads `agent_program_modules` (same registry as /agent and integrations). Live → acts; not live → "takes this over when X ships — you're first in line". `status: "missing"` rows carry a `reason`. Tests: `tests/lib/analyzer.test.ts`.
- **Cache**: `analyzer_scans` (domain PK, 24h) — service-role only. Rate limit 12 scans / IP / hour.
- **Trial tie-in**: CTA → `/start?scan=<domain>`; `/api/trial/start` stores `businesses.analyzer_scan_domain` and seeds up to 3 `agent_tasks` (owner atlas, reviewer hyperagent) from `firstThreeTasks()` — LIVE capabilities only. The trial still runs on the stock demo business; the tasks say so in their context.
- Gotcha (2026-10-10): a regex built from a template literal (`new RegExp(\`…${STATE}…\`)`) matched locally but never in the Vercel bundle. Keep analyzer regexes as literals (`CITY_STATE_RE`) and pin them with tests on real production text.
- Verified live 2026-10-10 on limitlessroofingokc.com: presence 40/100 + 4 errors; outbound 28 distinct prospect domains in Oklahoma City, OK (Exa); website 1 fix; chat none; reviews honest-missing (no Places key). ~2.6s uncached, instant cached.
- **THE SCOPE section** (`components/home/AnalyzeSection.tsx`) renders the five dimensions from `lib/analyzer/scope.ts`; each card's action line comes from `scopeAction()` (registry status), same honesty rule as the punch list.
- Optional env: `GOOGLE_PLACES_API_KEY` (turns the reviews row from "couldn't read" into rating + nearby competitor average). PageSpeed is not used: keyless quota is 0.
