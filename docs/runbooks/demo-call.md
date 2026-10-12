# Runbook — Book a demo call

The trial's CTA is replaced by **Book a demo call** (Roman, 2026-10-12). Triggers: homepage hero, `/agent`, the funnel pricing step ("Prefer to talk it through first?"). Component `components/demo/BookDemoCall.tsx`; logic `lib/demoCall/booking.ts`.

## What happens
1. **Slots** — `GET /api/demo-call/slots`: 30-minute slots, weekdays 9:00–16:30 **Eastern**, next 10 days, minus the busy blocks of the demo calendar (the primary owner's Google Calendar via `crm_calendar_connections`), nothing inside a 2-hour lead. Every time shown carries "ET". DST-aware (`etOffsetMinutes`, tested).
2. **Book** — `POST /api/demo-call/book {name, email, phone, website?, start, callNow}`: slot re-validated against the live calendar (no double booking) → **event on Rome's calendar with a Meet link and the prospect as attendee, `sendUpdates=all`** (Google emails them the invite → it lands on their calendar) → `demo_calls` row → our confirmation email (Resend) with the `.ics` attached and Google / Apple / Outlook links → in-app notification to every owner.
3. **"Free for a call right now?"** → `call_now=true`: instant **Slack** `chat.postMessage` to the connected workspace's webhook channel (#all-sfb-connect, `C0C89209WHG`) with `<!channel>`, plus an **email to every owner**, plus the in-app notification. Result of each alert is stored in `demo_calls.call_now_notify_result`. The prospect sees and is emailed: **"We'll get back to you within 5 minutes or less."** — Roman confirmed this is a real ops promise; whoever is on duty must call from **213-523-1641**.
4. **Save our number** — the success panel and the email say "Save 213-523-1641 as SFB CONNECT"; `GET /api/contact-card` serves a vCard (`SFB-CONNECT.vcf`).
5. `GET /api/demo-call/<id>/ics` — the event file (Apple / Outlook desktop).

## Tables
`demo_calls` (name, email, phone, website, start_at/end_at UTC, time_zone ET, calendar_owner_id, calendar_event_id, html_link, meet_url, call_now, call_now_notified_at, call_now_notify_result, status, source, signup_user_id) — migration `20261012_demo_calls.sql`. Team members read.

## Operate
- Cancel a booking (owner only): `DELETE /api/team/demo-calls/<id>` — removes the Google event (attendee gets Google's cancellation) and marks the row `canceled`.
- Slack alert `not_in_channel` (found live 2026-10-12): the code now `conversations.join`s the channel once and retries; if it still fails, add the SFB Connect app to the channel by hand.
- Who's booked: `select start_at at time zone 'America/New_York' as et, name, phone, email, call_now, call_now_notify_result from demo_calls order by start_at desc;`
- Calendar unreachable (owner's Google token revoked): the modal says so honestly and points to hello@sfbconnect.com; reconnect Google in `/team/integrations`.
- Slack alert says `not_connected` / `error:*`: check the Slack connection in `/team/integrations` (scope `chat:write`, channel from the incoming-webhook metadata).
- Rate limit: 5 bookings / IP / day.
- Tests: `tests/lib/demoCall.test.ts`.
