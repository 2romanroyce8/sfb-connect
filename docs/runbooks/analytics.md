# Analytics — Sales · Company · Stripe mirror

Roman, 2026-10-12: mirror the Stripe dashboard inside SFB and add a company view from our own data. `/team/charts` (sidebar "Analytics") now has three tabs; Company and Stripe mirror are **owner-only**.

## Where things are
| Piece | Location |
|---|---|
| Tabs | `components/team/analytics/AnalyticsTabs.tsx` (mounted by `app/team/(app)/charts/page.tsx`) |
| Sales (unchanged) | `RevenueAnalyticsView.tsx` ← `GET /api/team/analytics/revenue` ← `lib/team/analytics/revenue.ts` (`revenue_events`, per-rep scope) |
| Company | `CompanyAnalyticsView.tsx` ← `GET /api/team/analytics/company?range=` ← `lib/team/analytics/company.ts` |
| Stripe mirror | `StripeMirrorView.tsx` ← `GET /api/team/analytics/stripe?range=` ← `lib/team/analytics/stripeMirror.ts` |
| Cache | `lib/team/analytics/cache.ts` + table `analytics_cache` (migration `20261012_analytics_cache.sql`) |
| Tests | `tests/lib/analyticsMirror.test.ts` — aggregation math + a **static guard that no mutating Stripe method appears in stripeMirror.ts** |

## Stripe mirror — rules
- **Read-only.** Only `*.list()` and `balance.retrieve()` are called; the test fails the build if `.create/.update/.del/.cancel/.capture/.refund` ever appears in the module. The key is the same `STRIPE_SECRET_KEY` the app uses for checkout; Stripe has no per-key read scope on secret keys, so the guard is in code and tests, not in Stripe. (A restricted key with read-only permissions could be used instead if Rome wants belt and braces — set it as `STRIPE_SECRET_KEY` would break checkout, so it would need its own var; not done.)
- **Cached, never per page load.** `analytics_cache` key `stripe_mirror:<range>`, TTL **5 min**; the Refresh button forces a re-pull but honours a **30 s floor**. If a pull fails, the last good numbers stay up with "last pull failed: … — showing the previous numbers".
- **What's shown and how it's computed** (all in the account's default currency, from objects **created in the range**): gross volume = Σ succeeded charges; net = gross − refunds (succeeded/pending); failed payments = charges with `status=failed`; refunds (count + amount); disputes (count, amount, "needs response" = `needs_response|under_review|warning_*`); new customers = customer objects created; active subscriptions = `active`+`trialing` (past due shown separately), MRR = Σ price × quantity normalised to monthly; payouts = `paid` in range + in-transit; balance = `balance.retrieve()` available/pending.
- **Caveats, stated on the page:** lists are capped at 2,000 objects per type per pull ("truncated" flag → narrow the range); a test-mode key is labelled. Stripe's own dashboard uses its reporting timezone and may include fees/adjustments — expect gross/refund/dispute/customer/payout counts to match exactly for a period, and "net volume" to differ from Stripe's "net" (we don't subtract Stripe fees).

## Company view — definitions
- **Collected** = money that actually arrived, from our tables: `agent_plan_orders` (status paid/provisioned, by `paid_at`) + `addon_purchases` (completed, by `completed_at`) + `payments` (status confirmed, manual). Previous-period comparison for bounded ranges.
- **Booked in the CRM** = `revenue_events` (reps' closed deals: new_sale + renewal/upgrade − refund). Shown separately and labelled "booked ≠ collected".
- **Active clients** = `businesses` with a `plan_key`, not sandbox; by plan.
- **MRR** = active plans × their monthly price from `TIERS` (`lib/agentProgram/config.ts`); a business whose latest paid order is annual counts at `annualPerMonthUsd`. Legacy plan keys use `SFB_PLAN_PRICES`. This is a plan-based figure, not a Stripe subscription figure — compare with the Stripe tab's "MRR from Stripe prices".
- **Pipeline** = `crm_leads` not archived, grouped by `pipeline_stage`; est. value per stage = Σ `SFB_PLAN_PRICES[recommended_offer]` where set. "Won in range" = stage `won` updated since the range start.
- Cached 60 s so it lines up with the Stripe tab in time.

## Operate
- Force a fresh pull: Refresh on the tab, or `delete from analytics_cache where key like 'stripe_mirror:%'`.
- A number disagrees with Stripe: compare the same range in Stripe's dashboard with the reporting timezone set to America/New_York; check `truncated`; check the key is live-mode.
- Stripe not configured → the tab says so (503 from the route), nothing else breaks.
