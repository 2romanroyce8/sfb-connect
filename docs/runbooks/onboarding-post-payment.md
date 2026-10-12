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
| 6 ICP | `businesses.icp` set *(step ships in O2)* |
| 7 Lead list | ≥1 `outbound_prospects` **and** the user reviewed (`confirmed_steps.7`) *(O2)* |
| 8 Automations | an active `outbound_sequences` row *(O2)* |
| 9 DFY | `customer_onboarding.dfy_choice` *(O3)* |
| 10 Campaign | ≥1 prospect in_sequence/replied/booked or ≥1 approved/sent message *(O3)* |
| 11 Dashboard | confirmed / `completed_at` *(O3)* |
Steps 4–11 are **locked** until 2 and 3 are done. `/dashboard` redirects into the flow while the gates are open (`showFlow`); afterwards it shows a "Finish setting up" card and the sidebar "Finish setup" item until everything is done. "Go to dashboard, finish later" (`dismiss`) is offered only once the gates pass.

Steps 6–11 render an honest "next in line" panel (`StepNotYet`) until their slices ship — no fake progress.

## Resume
Drafts save as the user types (`step_data[step]`, debounced 800 ms). Logging in → `/dashboard` → current step with the inputs restored (step 1 reads `step_data.1` before the business row).

## Operate
- Where is a customer: `select b.legal_name, o.last_step, o.confirmed_steps, o.dismissed_at, o.completed_at from customer_onboarding o join businesses b on b.id=o.business_id;`
- Gmail/Calendar "connected" but step shows open: the connection must belong to `businesses.owner_id` (not a teammate). Check `integration_connections.owner_id` / `crm_calendar_connections.rep_id`.
- Brand pull failed: the site blocked the fetch or has no `<link rel=icon>/<img logo>`; the customer uploads instead (bucket `brand-assets/<business_id>/`).
- Thank-you page shows "Setting up…" for more than a minute: the Stripe webhook didn't provision — check `agent_plan_orders.status/error` and the webhook logs (`docs/runbooks/checkout.md`).
