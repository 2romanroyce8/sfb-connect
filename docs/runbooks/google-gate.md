# Runbook — Google connection "never blocked" gate (testing-mode bridge)

Roman, 2026-10-12. **The Google Cloud OAuth app (project `612333806040`) stays in TESTING MODE on purpose** until revenue funds Google verification and the restricted-scope (gmail.modify) security assessment. Testing mode admits only listed test users, cap **100**. The unforgivable outcome is a paying customer seeing Google's "Access blocked" page — so the Connect button does not exist until the team has cleared their address. **Do not "fix" a blocked customer by publishing the app.**

## Where things are
| Piece | File |
|---|---|
| Rules (pure, tested): who may start OAuth, thresholds 70/85/95, block at 95, verification task at 20, copy | `lib/google/gate.ts` |
| Server: clearances, counter, alerts, backstop | `lib/google/clearance.ts` — `submitEmail`, `markCleared`, `markConnected`, `recordAccessDenied`, `afterCountChange`, `gateOverview` |
| Customer UI (onboarding steps 2–3 + Integrations page) | `components/customerPortal/GoogleGate.tsx` |
| Customer API | `GET/POST /api/dashboard/google-gate` |
| Team UI (owner) | `/team/integrations` → **Google test users** panel (`components/team/GoogleGatePanel.tsx`) |
| Team API | `GET/POST /api/team/google-gate` (`mark_cleared`, `set_block`, `recount`) |
| Enforcement | `app/api/team/integrations/[provider]/connect` (gmail) and `…/google/connect` (calendar): customers refused unless `cleared`/`connected`; team members never gated |
| Backstop | both callbacks: `error=access_denied` for a customer → `/dashboard/google-not-cleared` (friendly), event logged, team alerted |
| Tables | `google_clearances` (per business: email, status, timestamps, denied_count), `google_gate_events`, `google_gate_state` (alerts fired, verification task, manual block) — migration `20261012_google_gate.sql` |
| Tests | `tests/lib/googleGate.test.ts` |

## Status machine
`not_started → email_submitted → cleared → connected`. Only `cleared`/`connected` render a live Connect button. `cleared + connected` = the tester-slot count shown as **"Google test users: N / 100"**.

## Team flow (≈30 seconds per customer)
1. Notification arrives (dashboard task to Atlas, in-app, owner email/SMS) with the **exact address** and a link to the console.
2. Open **Cloud Console → OAuth consent screen → Audience → Test users** (`https://console.cloud.google.com/auth/audience?project=612333806040`) and add the address.
3. In SFB `/team/integrations` → Google test users → **Mark cleared**. The customer is emailed "cleared — connect now" and their button goes live. (A successful OAuth also flips the row to `connected` automatically.)

## Cap guardrails
- Alerts (owners: in-app + SMS + email, each once): **70** verification should be underway · **85** urgent · **95** new clearances blocked (customers see "almost ready").
- At **20** cleared/connected: a high-priority task "Start Google OAuth verification + security assessment" is created once.
- Manual block: `POST /api/team/google-gate {action:"set_block", blocked:true}` (or flip `google_gate_state.clearances_blocked`).
- Reset after a simulation: `update google_gate_state set alerts_fired='[]', verification_task_id=null, verification_task_created_at=null where id=1;` then `recount`.
- Live-verified 2026-10-12 (owner login): the panel's **Mark cleared** button on an `email_submitted` row → `mark_cleared` API → row `cleared` with `cleared_by` = owner, `google_gate_events.cleared`, counter 0 → 1, customer "cleared — connect now" email sent. The QA row (`qa-gate-ui-test@sfbconnect.com`) was deleted afterwards and `recount` returned the counter to 0; its `cleared` event row remains in the log on purpose.

## Backstop
Google's own error page cannot be restyled. If a customer somehow reaches it and Google returns `access_denied`, the callback logs `google_gate_events(access_denied)` with email + timestamp, increments `denied_count`, alerts the team (callback_sla channel: SMS + email + in-app), and shows `/dashboard/google-not-cleared`. Google's raw text is never surfaced.

## Operate
- Queue: `select email, status, submitted_at, denied_count from google_clearances order by submitted_at desc;`
- Count: `select count(*) from google_clearances where status in ('cleared','connected');`
- Events: `select * from google_gate_events order by created_at desc limit 30;`
- A customer says "I can't see Connect": their row is `email_submitted` — add them in the console and Mark cleared. If the row is missing they haven't told us the address yet (step 2 asks for it).
