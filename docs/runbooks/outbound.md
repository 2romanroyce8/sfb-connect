# Runbook — Outbound / GTM (Phase 1, 2026-10-11)

Enrich → write → **human approval** → send → track → book. Every charged step goes through `chargeAction` (`spend_credits`: idempotent, never negative, 0-credit receipt on failure) behind `workAllowed`. **No code path sends without a human approval recorded on the row** (`lib/outbound/gate.ts` `canSend`). Trial (sandbox) businesses never send — the message becomes `simulated`.

## Where things are
| Piece | File |
|---|---|
| Rules (pure, tested) | `lib/outbound/gate.ts` — `canSend`, `dueSteps`, `proposeSlots`, `pickEmail`, `unsubscribeToken` |
| Copy | `lib/outbound/templates.ts` — the ONLY outreach copy; placeholders resolve from verified facts or refuse |
| Engine | `lib/outbound/engine.ts` — `addProspect`, `importFindings`, `enrichProspect`, `draftMessage`, `startSequence`, `approveMessage`, `rejectMessage`, `sendApprovedMessage`, `recordOpen`, `unsubscribe`, `syncReplies`, `advanceSequences`, `proposeMeetingSlots`, `bookMeeting`, `runOutboundSync` |
| Team UI | `/team/outbound` (`components/team/OutboundWorkspace.tsx`) — owner / assigned overseer; Sales › Outbound |
| Team API | `POST /api/team/outbound {action: set_offer_line|add_prospect|import_findings|enrich|start_sequence|draft|approve|reject|send|slots|book|sync}` |
| Agent tools (MCP) | `lib/agent/outboundTools.ts` — `list_sfb_outbound`, `sfb_outbound_add_prospect`, `sfb_outbound_enrich`, `sfb_outbound_draft`, `sfb_outbound_slots`, `sfb_outbound_book` — scope `sfb:outbound:run` (a WRITE scope: not grantable until Roman flips `GRANTABLE_SCOPES`). **There is deliberately no agent tool that approves or sends.** |
| Tracking | `GET /api/outbound/o/<message id>.gif` (open pixel), `GET /api/outbound/unsubscribe/<id>/<token>` (one click, HMAC token per message) |
| Cron | `POST /api/cron/outbound-sync` hourly (`outbound-sync-hourly`, Vault token `outbound_cron_token`, settings `outbound_cron_settings`): pulls replies from Gmail threads, drafts due sequence steps → approval queue |
| Tables | `outbound_prospects`, `outbound_sequences`, `outbound_messages`, `outbound_bookings`, `outbound_suppressions`, `outbound_events`, `outbound_cron_settings`; `businesses.outbound_offer_line`, `businesses.outbound_time_zone` — migration `20261011_outbound.sql` |

## Credits (from `CREDIT_PRICES`)
| Step | Action key | Credits | Outcome rule |
|---|---|---|---|
| Enrich | `outbound.prospect_enriched` | 2 | 0 when nothing public was found or no website |
| Draft | `outbound.message_written` | 2 | charged when the draft lands in the queue |
| Approve | `human.review_pass` | 5 | charged when a human approves |
| Send | — | 0 | sends are free (FREE_ACTIONS) |
| Book | `outbound.meeting_booked` | 5 | charged when the calendar event exists (or simulated on trial) |

## Preconditions per business
- `plan_key` set and credits > 0 (`workAllowed`); otherwise every step refuses with a clear reason.
- **Offer line** (`businesses.outbound_offer_line`) — the one owner-approved sentence every intro uses. Empty = intro cannot be drafted (refuses, no guessing).
- Sends: the business **owner's** Gmail connection (`integration_connections` provider `gmail`, `owner_id` = `businesses.owner_id`). Bookings: the owner's Google Calendar connection.

## Honesty + safety rules enforced in code
- Names, emails, phones, cities come from the prospect's own site (mailto / visible text / City, ST) or the owner; never invented. A template that references a fact we don't have throws.
- Suppression list (`unsubscribed` / `bounced`) blocks drafting AND sending; unsubscribe also rejects any queued messages for that prospect.
- Approve requires: team owner, the business owner, or the business's assigned overseer. Approve = charge review pass → (optionally) send. Reject keeps the reason on the row.
- Open tracking is a pixel (opens are a hint, not a fact). Replies are detected by Gmail thread, stored as `direction=in` rows.

## Operate
- Pending approvals: `select count(*) from outbound_messages where status='pending_approval'`.
- Cron health: `select last_run_at, last_result from outbound_cron_settings`; `select * from cron.job where jobname='outbound-sync-hourly'`. Pause: `update outbound_cron_settings set enabled=false; select outbound_cron_schedule();`
- A send failed: `outbound_messages.error` has Gmail's message; "not connected" → owner reconnects Gmail in Integrations.

## Not in Phase 1
Customer-facing approval queue (Phase 2), LinkedIn channel, bounce webhooks (Gmail has none — bounces arrive as replies and are left to the human), reply classification / auto-drafted replies (agent drafts via `sfb_outbound_draft reply_thanks`).
