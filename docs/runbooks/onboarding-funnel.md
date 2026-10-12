# Runbook — Onboarding funnel (gated pricing, no trial)

**Decision (Roman, 2026-10-12 01:40 ET):** the trial is gone — no trial tier, no free credits, no trial emails, no expiry/pause logic, no guarantee copy. Pricing is **hidden** everywhere public (`/pricing` redirects to `/start`; no nav/footer link; no prices on the homepage or `/agent`). Price is shown only inside the funnel after the visitor has verified their email and watched the build show. Then they pay to finish onboarding and unlock the dashboard.

## The flow (`/start`, server-resolved stage)
| Stage | Where | What happens |
|---|---|---|
| 1 `account` | `components/funnel/FunnelFlow.tsx` → `POST /api/funnel/account` | name, work email, phone, business website, password. Auth user (email NOT confirmed yet) + `funnel_signups` row + first 6-digit code (Resend). Browser signs in with the password. **No price anywhere.** |
| 2 `verify` | `POST /api/funnel/verify {code}` · `PUT` = resend | 10-min code, 5 attempts, 3 resends / 60 s. On success `funnel_signups.email_verified_at`, auth email confirmed, audit `funnel_verified`. |
| 3 `build` | `POST /api/demo/build` (stream) → `POST /api/funnel/profile` | the build show on their website (name, logo, services, niche via `classifyNiche` + tags, City/ST, phone, socials, one-line offer, writing style) → "Here's what your agent learned" → confirm/correct → profile saved on the signup. |
| 4 `pricing` | `PricingTiers funnel` → `POST /api/agent/checkout {plan, interval}` | Solo / Agency with anchors, monthly \| annual. Checkout is **session-gated**: refused unless the signup is verified and has a profile (403 → `/start`). Order carries `signup_id`. |
| `done` | webhook `provisionAgentCustomer` | business created for the signup's user from the confirmed profile (name, website, niche + tags, city/state, phone, services, socials, logo, tone, offer line), all 8 capabilities on, first month's credits, audit `agent_plan_provisioned {from_signup:true}`. `/agent/welcome` sends a signed-in, provisioned user to `/dashboard/agent?welcome=paid`. |

`stageFor(signup, hasBusiness)` (`lib/funnel/signup.ts`, tested) is the single rule: business with plan → done; no signup → account; unverified → verify; no profile → build; else pricing. `/start` always resumes at the right step; `/dashboard/no-membership` says "Finish setting up your agent" and links to `/start`.

## Data
- `funnel_signups` (user_id unique, email, name, phone, website, domain, build_id, profile jsonb, email_verified_at, pricing_seen_at) — migration `20261012_remove_trial_gated_funnel.sql`.
- `agent_plan_orders.signup_id`.
- Trial rows at cut-over: 2 stock-data sandbox demos deleted; real-looking unpaid signups (Trash Splash ×2, Escape The Matrix, the +sfbdemo test) kept as accounts with `plan_key = null` → they land on the funnel. Columns `is_sandbox`, `trial_expires_at`, `email_verified_at`, `stock_profile_key` remain in the schema, unused.

## Removed
Trial tier (`config.ts`), `TRIAL_TIER`, stock profiles, `lib/agentProgram/trial.ts`, `/api/trial/*`, `/api/demo/create|verify`, `TrialWizard`, `TrialResume`, `DemoStart`, `/start/welcome`, trial/demo welcome emails, `trial_expired` / `email_unverified` guards, sandbox "simulated" sends, homepage `TiersSection`/`AgentTiersRow`, trial column on pricing cards, guarantee line, every "free trial / $1 / no card / 5 days" string. Legal docs: only the factual trial references were removed (Terms pricing bullet, "starting a trial", two Privacy examples) — wording stays Atlas's; flag for review.

## Verify
- Logged-out `/start` shows step 1 and no price; `/pricing` → `/start`; `curl /` and `/agent` contain no "$1,497".
- Fresh signup → code → build → pricing visible → Stripe Checkout opens with the right plan; `agent_plan_orders.signup_id` set; webhook provisions from the profile.
- Tests: `tests/lib/funnel.test.ts`, `pricing.test.ts`, `agentProgram.test.ts`, `legal.test.ts`.

## Incident 2026-10-12 — "Account created, but sign-in failed"
Root cause: `createAccount` created the auth user with `email_confirm: false` while the Supabase project has "Confirm email" on, so the immediate `signInWithPassword` was rejected with "Email not confirmed". Our 6-digit code (`funnel_signups.email_verified_at`) is the real verification gate, so Supabase's flag only blocked legitimate sign-ins. Fix: users are created (and abandoned ones re-armed) with `email_confirm: true`; the account route now signs the visitor in on the same response and logs `[funnel-account cid=…]` with the stage that failed; the browser falls back to its own sign-in and, failing that, shows a retry-safe message carrying the `cid`. Stranded accounts created by the bug were repaired by setting `auth.users.email_confirmed_at`. Look up a report: search Vercel runtime logs for the `cid` the customer quotes.
