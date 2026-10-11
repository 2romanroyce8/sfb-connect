# Runbook — The 5-day demo (Phase 2)

**The demo IS the product.** Same dashboard, same agent, same approval queue as paid. The only trial differences: a 5-day clock and a 128-credit cap. No sandbox, no stock data, nothing simulated: real prospects, real emails from the owner's own Gmail, and **nothing sends without the owner's explicit approval**. Free, no card anywhere in the flow (Roman, 2026-10-11 18:09 ET).

## Slice (a1) — signup through verified account (shipped 2026-10-11)
| Step | Where | What happens |
|---|---|---|
| 1. URL + work email → "Build my agent →" | `/start` (`components/demo/DemoStart.tsx`) | ungated |
| 2. Build show (~2 min feel, usually 5–20 s) | `POST /api/demo/build` → NDJSON | `lib/demo/build.ts` `buildProfileFromSite`: name (title/og/JSON-LD), logo (header → og:image → icons, verified), services (nav + headings, service-like words only), writing-style notes (checkable observations: "Speaks as we", "Short sentences", …), niche (`categoryHint`), City, ST (`marketFromHtml`), social profile links, phone, one-line offer (og:description / meta / first heading). Each fact is null when not found — never invented. Row in `demo_builds`. |
| 3. "Here's what your agent learned" | review screen | every field editable; **required**: business name, your name (signs the emails), phone, one-line offer. Logo missing → told to add from the dashboard (upload = slice b). |
| 4. Account + business | `POST /api/demo/create` → `createDemoAccount` | auth user with **no password** (`email_confirm:false`), `businesses` row: `plan_key='trial'`, `is_sandbox=false`, real profile (`phone, city, state, slug, brand_logo_url, tone_notes, services, social_links, outbound_offer_line, analyzer_scan_domain, demo_build_id`), `trial_expires_at=null`, `email_verified_at=null`; capabilities: all 8 rows, **outbound_gtm on**, others off (ready toggles). First code sent. Pending identity in signed httpOnly cookie `sfb_demo_pending` (never client ids). Audit `demo_created`. |
| 5. Email code gate | `POST /api/demo/verify {code}` · `PUT` = resend | `lib/demo/verification.ts`: 6 digits, hashed, 10-min expiry, 5 attempts/code, 3 resends, 60 s cooldown; Resend from `RESEND_FROM_EMAIL`. |
| 6. Activation | `activateDemo` | `email_verified_at=now`, **`trial_expires_at = now + 5d`**, `credits_cycle_started_at`, 128 PROMOTIONAL credits (`trial:<biz>`), auth email confirmed, audit `trial_started {provisioned_via: demo_verified}`, welcome email. Browser signed in server-side (admin magic link → `verifyOtp`), redirect `/dashboard/agent?setup=gmail`. |

**Server-side block:** `workAllowed` (`lib/billing/guards.ts`) returns `email_unverified` for a non-sandbox trial without `email_verified_at` — before the credit check — so every charged action (tasks, drafts, sends, bookings) refuses until verified. Not just UI.

**Decisions made inside the brief (flag to Roman):** clock + credits start at verification, not signup; trial `capabilityLimit` 3 → 8 ("tiers differ in credits + overseer only"); the old sandbox wizard (`components/agent/TrialWizard.tsx`, `POST /api/trial/start`, stock profiles) is still in the repo but unreachable from the UI — remove when Roman says so; returning sign-in for password-less demo users needs a magic-link option on `/login` (slice a2).

## Slice (a2) — next
Gmail OAuth required in setup (`/api/team/integrations/gmail/connect?return=dashboard`, allowed on the non-sandbox trial); approved sends queue until Gmail is connected and flush on connect; first 3 tasks (25 real dream clients in niche + city via Exa, intro drafts generic vs their-voice side-by-side, approve → real send); customer approval queue on `/dashboard`.

## Operate
- Builds: `select domain, email, status, created_at from demo_builds order by created_at desc limit 20;`
- Stuck at verification: `select b.legal_name, b.email_verified_at, c.attempts, c.expires_at from businesses b join email_verification_codes c on c.user_id=b.owner_id where b.plan_key='trial' and b.email_verified_at is null order by c.created_at desc;`
- Abandoned unverified demos are replaced automatically if the same email signs up again; verified accounts are told to sign in.
- Rate limits: build 20/IP/h, create 6/IP/day, verify 40/IP/h.
- Tests: `tests/lib/demo.test.ts`.
