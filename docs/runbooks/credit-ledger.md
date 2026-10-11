# Runbook — Credit ledger & guards

**Truth:** `credit_transactions` is an append-only ledger; balance = sum of rows (`get_credit_balance`). Never stored as a mutable counter.

## Rules (also published on /agent and /dashboard/credits)
- One credit type. Monthly allotment spends first and never rolls over; top-ups never expire while membership is active.
- Ledger can never go negative: `chargeAction` (`lib/billing/guards.ts`) checks balance ≥ cost before writing and sets `businesses.work_paused_reason='out_of_credits'` when refused.
- Failed work costs 0 — a 0-credit USAGE row is written so the feed shows "Failed · 0 credits".
- Completed work costs credits even if disliked: "credits pay for work done, not outcomes".
- Thresholds: 80% used → `warn` (banner), 95% → `critical`, 0 → `empty` (work pauses; reports still work). `creditState(balance, allotment)`.
- Free (0): sends, report views, logins, toggles.

## Charging an action (for the agent runner)
```ts
await chargeAction(service, { businessId, actionKey: "outbound.meeting_booked", outcome: "completed" | "failed", idempotencyKey: `<task_id>:<step>`, resultRef?: "<url or id of the work>", approvedBy?: "<overseer user id>" });
```
`chargeAction` calls the Postgres function **`spend_credits`** (migration `20261010_credit_economy.sql`) — the ONLY spend path:
- **Idempotent:** an idempotency key seen before returns the original row and writes nothing (verified live 2026-10-10: retry returned the same row id). This is what stops a retried request from double-spending.
- **Atomic / serialized:** `pg_advisory_xact_lock` per business, balance re-read under the lock, so two concurrent spends can't both pass the check.
- **Never negative:** cost > balance raises `INSUFFICIENT` (no row written); `chargeAction` then sets `work_paused_reason='out_of_credits'`, emails the owner and the overseer, and throws `InsufficientCreditsError`.
- **Failed work = 0:** a 0-credit USAGE row ("didn't go through") is still written as the receipt.
- Unknown action key → rejected before the DB is touched. `spend_credits` is service-role only (revoked from anon/authenticated).

Action keys and prices: `CREDIT_PRICES` in `lib/agentProgram/config.ts` (pinned exactly by `tests/lib/creditEconomy.test.ts`). `workAllowed(service, businessId)` tells the runner whether paid work may proceed (plan present, trial not expired, balance > 0).

## Balance display ("132 / 150 + 40 top-up")
`get_credit_breakdown(business_id)` (security invoker — customer RLS) derives from the ledger: `monthly_spent` = usage since `credits_cycle_started_at` capped at the allotment; `monthly_remaining` = allotment − spent; `topup_balance` = balance − monthly_remaining. Nothing is stored. `getCreditBreakdown()` / pure `splitBalance()` in `lib/billing/guards.ts`; the dashboard strip, capability meters and Credits tab all read it via `loadAgentState`.

## Cycle
- Trial: 128 PROMOTIONAL credits once; ends at 0 or 3 days (TIERS.trialDays; Roman set 3 on 2026-10-11 — final).
- Paid: `provisionAgentCustomer` grants the tier's credits on checkout; `invoice.paid` (billing_reason=subscription_cycle) runs `expireUnspentAllotment` (EXPIRATION row for unspent allotment: allotment − usage since `credits_cycle_started_at`, floored at 0; top-ups untouched) then grants the new month.
- Top-ups: `credit_packages` rows (100/$149, 500/$599, 1,000/$999); Stripe price created by lookup key `sfb_topup_<credits>` on first purchase; webhook `checkout.session.completed` → PURCHASE row (existing path).

## Atlas visibility
Read-only receipts via the agent connector: `get_sfb_ai_presence`/business tools expose balances; a dedicated `get_sfb_credit_ledger {business_id}` tool is the next addition (tracked).

## Dashboard wiring (2026-10-10)
- Agent tab strip: `monthly_remaining / allotment` (+ top-up), bar amber ≥80% / red ≥95%, **Top up** button (paid plans), trial copy says "go live" instead of "top up".
- Activity feed and Credits ledger show per-action cost; 0-credit failures read "0 credits — didn't go through". Ledger filter (grants / failed / per capability) + CSV export.
- Trial: ledger visible, **no price list and no planning calculator** (`priceListVisible=false`, `isSandbox=true`); 80% → "go live" nudge; 0 or expiry → paused banner → `/pricing`.
- Billing tab: plan, **Stripe invoices** (`lib/billing/invoices.ts`, real `invoices.list`; empty on trial), top-up/add-on purchase history.
- "Credits pay for work done, not outcomes" appears on /pricing, the plan checkout sheet, and the top-up section.

## Emails
80% warning and zero notice to the owner via Resend (once per cycle); at zero the assigned overseer (`businesses.agent_overseer_id`) is emailed too.
