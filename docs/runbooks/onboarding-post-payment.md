# Runbook — Post-payment onboarding (thank-you page + 11-step flow)

Roman, 2026-10-12: starts the moment Stripe checkout succeeds. No trial. Steps 2–3 (Gmail, Google Calendar) are the only hard gates; everything else can be finished later from the dashboard checklist. Honest at every step; $0 — nothing here costs credits.

## Where things are
| Piece | File |
|---|---|
| Step definitions, derivation, gates, profile validation, brand-color extraction (pure, tested) | `lib/onboarding/flow.ts` — `STEPS`, `deriveOnboarding`, `parseProfileInput`, `extractBrandColors` |
| Server: facts gathering + the one writable row | `lib/onboarding/state.ts` — `loadOnboarding`, `confirmStep`, `saveStepData`, `customerBusiness` |
| Thank-you page (step 0) | `app/agent/welcome/page.tsx` (+ `components/onboarding/ProvisionPoller.tsx`) — Stripe `success_url` |
| Flow pages | `/dashboard/onboarding` (resume → current step), `/dashboard/onboarding/<slug>` (`profile, gmail, calendar, brand, capabilities, icp, leads, automations, dfy, campaign, dashboard`) |
| UI | `components/onboarding/OnboardingShell.tsx` + `steps/*` |
| API | `GET/POST /api/dashboard/onboarding` (`save`, `confirm`, `dismiss`, `brand_pull`, `brand_colors`), `POST /api/dashboard/onboarding/logo` |
| Customer OAuth | `/api/team/integrations/gmail/connect?return=onboarding`, `/api/team/integrations/google/connect?return=onboarding` → callbacks return to the step |
| Tables | `customer_onboarding` (confirmed_steps, step_data, dfy_choice, dismissed_at, completed_at), `businesses.icp`, bucket `brand-assets` — migration `20261012_customer_onboarding.sql` |
| Tests | `tests/lib/onboarding.test.ts` |

## How completion is decided (never a fabricated percentage)
| Step | Done when |
|---|---|
| 1 Profile | user clicked "Looks right" (`confirmed_steps.1`); the form writes `businesses` (name, website, category, niche_tags, city/state, phone, services, offer line) |
| 2 Gmail | `integration_connections` row provider=gmail, owner = business owner, status active |
| 3 Calendar | `crm_calendar_connections` row for the owner without `refresh_failed_at` |
| 4 Brand | `businesses.brand_logo_url` set, or confirmed without a logo |
| 5 Capabilities | confirmed (toggles themselves live in `business_capabilities`) |
| 6 ICP | `businesses.icp` set — suggested from the category preset (`lib/analyzer/icp.ts`) + own city/state, edited by the customer (`lib/onboarding/icp.ts`) |
| 7 Lead list | ≥1 `outbound_prospects` **and** the user reviewed (`confirmed_steps.7`). Candidates come from Exa (company category, one query per ICP industry × location, ≤ 6 searches, directories/own domain/existing prospects filtered — `lib/onboarding/leads.ts`), sit in `step_data.7.candidates` until the customer removes/keeps; kept ones become prospects with status `sourced` (0 credits). Nobody is contacted here. |
| 8 Automations | an active `outbound_sequences` row named `Default 3-step` — cadence steady/quick/patient (`lib/onboarding/automations.ts`), preview rendered from the real templates with the business's facts; refuses (and links to step 1) when the offer line is missing |
| 9 DFY | `customer_onboarding.dfy_choice` ∈ install / retainer_talk / self_serve. **Install = $8,000 one-time (Rome's number)** — `addon_products.key='dfy_install'`, Stripe Price by lookup key `sfb_dfy_install_8000` created on first checkout (`lib/billing/dfy.ts`), paid through the existing `addon_purchases` + webhook; on payment `onDfyPurchased` sets the choice, creates an URGENT team task "DFY install purchased — start handoff" and alerts owners; nothing the customer configured resets. Retainer = "Talk to us" (opens Book a demo call, no price): the popup reports on every dismiss (X, backdrop, Esc, Done) whether a booking completed (`BookDemoCall onClose → { booked, callId }`); **booked + closed → `dfy_choose retainer_talk` with the call id (server checks `demo_calls.signup_user_id` = the customer, not cancelled) → step 9 confirmed, `step_data.9.demo_call_id`, auto-advance to step 10**; closed without booking → stays on step 9, nothing saved. Booking itself (calendar event, invite, team alerts) is untouched. Self-serve = one click. All three converge on step 10. |
| 10 Campaign | ≥1 prospect in_sequence/replied/booked or ≥1 approved/sent message. Launch (`lib/onboarding/campaignRun.ts`) runs the outbound engine for the first batch (≤10): enrich → draft → **pending_approval**; the customer approves per item or all → human review pass charged → send when their Gmail is connected (else stays `approved`, queued). Plan (`lib/onboarding/campaign.ts`) caps the batch by balance; zero/insufficient → top-up prompt, never a dead end; ledger never negative (spend_credits). |
| 11 Dashboard | confirmed → `completed_at`. Shows the live agent feed (`lib/customerPortal/agentFeed.ts`: outbound_events + credit receipts, human-approved badges; honest empty state). The same feed sits at the top of `/dashboard`. |
Steps 4–11 are **locked** until 2 and 3 are done. `/dashboard` redirects into the flow while the gates are open (`showFlow`); afterwards it shows a "Finish setting up" card and the sidebar "Finish setup" item until everything is done. "Go to dashboard, finish later" (`dismiss`) is offered only once the gates pass.

All 11 steps are live (O3 shipped 2026-10-12). `StepNotYet` is gone.

## Resume
Drafts save as the user types (`step_data[step]`, debounced 800 ms). Logging in → `/dashboard` → current step with the inputs restored (step 1 reads `step_data.1` before the business row).

## Operate
- DFY purchase paid but step 9 still open: the Stripe webhook didn't arrive — `addon_purchases` row for key `dfy_install` with status pending; check `/api/webhooks/stripe` logs; `onDfyPurchased` is idempotent and can be re-run.
- Campaign approvals say "approved · queued": the customer's Gmail isn't connected (or the Gmail API isn't enabled in the Google project) — `sendApprovedMessage` will send once it is; approvals are never lost.
- Lead search returned nothing: `step_data.7.queries` shows what was searched; Exa cost is logged via `logSearchCall`. Widen the ICP in step 6.
- Where is a customer: `select b.legal_name, o.last_step, o.confirmed_steps, o.dismissed_at, o.completed_at from customer_onboarding o join businesses b on b.id=o.business_id;`
- Gmail/Calendar "connected" but step shows open: the connection must belong to `businesses.owner_id` (not a teammate). Check `integration_connections.owner_id` / `crm_calendar_connections.rep_id`.
- Brand pull failed: the site blocked the fetch or has no `<link rel=icon>/<img logo>`; the customer uploads instead (bucket `brand-assets/<business_id>/`).
- Thank-you page shows "Setting up…" for more than a minute: the Stripe webhook didn't provision — check `agent_plan_orders.status/error` and the webhook logs (`docs/runbooks/checkout.md`).
