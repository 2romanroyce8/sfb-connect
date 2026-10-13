# Runbook — Owner text alerts (carrier email-to-SMS via Resend)

Roman, 2026-10-12: owners get alerts by **text** with no new paid service — the message is emailed through Resend (sfbconnect.com, verified) to the carrier's email-to-text address. Email is the fallback. **Notifications only — this path must never carry outreach** (carriers burn the route). Two-way SMS is out of scope (Phase B).

## Where things are
| Piece | File |
|---|---|
| Carrier table, phone normalization, 160-char splitting, channel decision (pure, tested) | `lib/notify/sms.ts` — `CARRIERS`, `gatewayAddress`, `splitSms`, `decideChannels` |
| Fan-out (in-app + SMS + email, logging, bounce self-heal, coalescing) | `lib/notify/ownerAlerts.ts` — `alertOwners`, `sendGatewaySms` |
| New-lead helper | `lib/notify/leadAlert.ts` |
| Settings UI (per person) | `/team/settings` → **Text alerts** (`components/team/TextAlertsSection.tsx`) |
| API | `GET/POST /api/team/notifications/sms` — `save`, `test`, `verify` |
| Tables | `users.notify_phone / notify_carrier / notify_prefs / notify_sms_verified_at / notify_sms_last_bounce_at`, `notification_deliveries` — migration `20261012_owner_sms_alerts.sql` |
| Tests | `tests/lib/sms.test.ts` |

## Carrier reality (sourced 2026-10-12 — do not list a gateway as working when the carrier says it is gone)
| Carrier | Address | Status |
|---|---|---|
| AT&T / Cricket | — | **Shut down 2025-06-17** (att.com support KM1061254). Alerts go to email. |
| Verizon / Visible / Xfinity Mobile | `vtext.com` | **Sunsetting**: Verizon notice says shutdown completes by 2027-03-31 and some senders already fail. Test it. |
| T-Mobile / Metro / Mint | `tmomail.net` | **Unconfirmed**: no shutdown notice, but admins widely report non-delivery since late 2024. Test it. |
| Google Fi | `msg.fi.google.com` | Documented by Google. |
| UScellular, Boost | `email.uscc.net`, `sms.myboostmobile.com` | Unconfirmed. |
| VoIP (Google Voice, OpenPhone…) | — | No gateway exists. Email. |

## Routing rules (`decideChannels`)
- Trigger off in prefs → nothing (logged `skipped · pref_off`). **`callback_sla` cannot be turned off.**
- No phone / no carrier / carrier shut down / bounce in the last 7 days → SMS `fallback`, email sent with that reason.
- Gateway available and **not yet verified** → SMS **and** email (`unverified_sms`). Verified → SMS only.
- `callback_sla` → SMS **and** email **and** in-app, always, in parallel (plus Slack `<!channel>` from `lib/demoCall/booking.ts`).
- `approval_pending` → one text per person per 10 minutes (`coalesced`), in-app every time.
- Before each send, the previous gateway send is checked against Resend (`emails.get` → `last_event`); `bounced`/`complained` marks `notify_sms_last_bounce_at` → email for 7 days. Changing phone/carrier clears verification and bounce state.
- SMS body is forced to ASCII and split at word boundaries into `(i/n) ` parts ≤ 160 chars. Subject is empty (gateways prepend it).

## Triggers wired
| Trigger | Fires from |
|---|---|
| `lead_new` | `POST /api/leads`, `POST /api/services/inquiry`, funnel email verified (`lib/funnel/signup.ts verifySignup`) |
| `demo_booked` | every demo booking (`lib/demoCall/booking.ts notifyTeam`) |
| `callback_sla` | demo booking with "Free for a call right now?" — time-critical |
| `credits_warning` / `credits_exhausted` | `lib/billing/guards.ts notifyCreditThresholds` (customer email unchanged; team owners now also alerted) |
| `system_health` | hourly sync errors (`runOutboundSync`), stalled sync watchdog (`/api/cron/plan-refill`), dead Gmail/Calendar token (`probeConnections`) → owners; configurable, coalesced to one text per hour (added 2026-10-12, G9/G12) |
| `approval_pending` | `lib/outbound/engine.ts draftMessage` → owners + the business's assigned overseer. Live-fired 2026-10-12 20:17:59Z (draft via `/api/team/outbound`): SMS 1/1 sent to Roman's gateway + email (`unverified_sms`) + in-app; Muse (no phone) → email fallback + in-app. |
| `sms_test` | Settings → "Send me a test text" |
"Push" = the in-app bell (`crm_notifications`) + Slack; there is no browser push service.

## Operate
- Who gets texts: `select email, notify_phone, notify_carrier, notify_sms_verified_at, notify_sms_last_bounce_at from users where team_role='owner';`
- What went out: `select created_at, trigger, channel, to_address, status, reason, provider_last_event from notification_deliveries order by created_at desc limit 50;`
- A text "didn't arrive" but status is `sent`: look at `provider_last_event`. `delivered` = Resend handed it to the carrier gateway (the carrier may still filter); `bounced` = that gateway is dead for this line → the system already moved them to email for 7 days. `null` = Resend hasn't reported yet; the next alert for that person reconciles it.
- Carrier shut down since this was written: set its `gateway: null, status: "shutdown"` in `CARRIERS` with the source in `note`.
- Never add bulk/outreach sends to `sendGatewaySms`.
