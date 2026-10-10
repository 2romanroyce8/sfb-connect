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
await chargeAction(service, { businessId, actionKey: "outbound.meeting_booked", outcome: "completed" | "failed", idempotencyKey: `<task_id>:<step>` });
```
Action keys and prices: `CREDIT_PRICES` in `lib/agentProgram/config.ts`. Unknown key throws. `workAllowed(service, businessId)` tells the runner whether paid work may proceed (plan present, trial not expired, balance > 0).

## Cycle
- Trial: 128 PROMOTIONAL credits once; ends at 0 or 3 days (TIERS.trialDays).
- Paid: `provisionAgentCustomer` grants the tier's credits on checkout; `invoice.paid` (billing_reason=subscription_cycle) runs `expireUnspentAllotment` (EXPIRATION row for unspent allotment: allotment − usage since `credits_cycle_started_at`, floored at 0; top-ups untouched) then grants the new month.
- Top-ups: `credit_packages` rows (100/$149, 500/$599, 1,000/$999); Stripe price created by lookup key `sfb_topup_<credits>` on first purchase; webhook `checkout.session.completed` → PURCHASE row (existing path).

## Atlas visibility
Read-only receipts via the agent connector: `get_sfb_ai_presence`/business tools expose balances; a dedicated `get_sfb_credit_ledger {business_id}` tool is the next addition (tracked).

## Not yet
80% warning **email** (needs an email provider; banner + dashboard state are live). Overseer notification at zero (same dependency).
