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

## Sending account (switched 2026-10-12)
The owner's Gmail **and** Google Calendar connections are on the company account **sfbconnects@gmail.com** (previously Roman's personal address). Both live under Roman's team user (`owner_id` = `a7398ad8…`); the account label comes from Google's userinfo at connect time — nothing in source names the address. Verified live 2026-10-12: approval-queue send `766d9892` → Gmail id `1a131c50f838be41`, headers `From: SFB CONNECTS <sfbconnects@gmail.com>`; reply sync lists the `sfbconnects@gmail.com` inbox; demo booking created a Calendar event with `organizer: sfbconnects@gmail.com` + Meet link. To move accounts again: `/team/integrations` → Gmail → Disconnect → Connect Gmail (sign in as the new account, allow send + modify), then Google Calendar → Disconnect → Connect. Anyone with the new account's password can do it; no code or env change.

Resolved the same day: the **Gmail API is now enabled** on project 612333806040 (it was not on 2026-10-11, which made every approved send fail with `Gmail API has not been used in project … or it is disabled`). If that error ever returns: Google Cloud console → APIs & Services → Library → Gmail API → Enable, then `/team/outbound` → "approved messages failed to send" → **Retry send**.

Subject headers with non-ASCII (em dash, curly quotes) are RFC 2047-encoded by `encodeHeaderValue()` in `lib/integrations/gmail.ts` (found live 2026-10-12: raw UTF-8 arrived as `Ã¢Â€Â”`).

## Email templates, library and custom emails (2026-10-12)
**Where:** step 10 ("What should the first email say?") and `/team/outbound` → Approval queue → "Compose & templates". Shared component `components/outbound/ComposePicker.tsx`; three modes.
- **Have the agent draft** — uses the business's intro: `businesses.outbound_intro_template` if set, else the deterministic recommendation in `lib/outbound/presets.ts recommendIntro()` (consumer when >50 % of uncontacted prospects are people — uploaded rows with no website where the person is the prospect — or the ICP wording reads consumer: homeowner, patient, resident, tenant, parent, family…). The customer sees the recommendation with its reason, both intros side by side, and can override with one click (`template_pick`; null = back to the recommendation). Follow-ups swap to consumer wording when the intro is consumer (`resolveStepTemplate`).
- **Pick a preset** — the library (`LIBRARY` in presets.ts + the business's `outbound_templates`), by category (intro to a business · intro to a person · follow-ups · re-engagement · booking nudge · review request · testimonial request · your saved presets), each previewed with the business's own info and its first uncontacted prospect (or a labelled sample). Any intro-type preset can also become the sequence intro.
- **Write my own** — subject + body with the shared variables (`TEMPLATE_VARIABLES`; aliases like `{{first name}}`, `{{your company}}` accepted; unknown placeholders refused with the allowed list), live preview, **Agent help** (shorter / friendlier / more direct / more formal / fix grammar — `lib/outbound/assist.ts`, Anthropic `claude-sonnet-4-6`, needs `ANTHROPIC_API_KEY`; the guard `checkAssistResult` rejects any edit that drops/adds a placeholder; **without a key the buttons are not rendered at all** — see "Editing help: activation, spend log, daily cap" below), and **Save as preset**. A custom email is drafted per prospect through the same `draftMessage` (2 credits), lands in the same approval queue (5 credits to approve), sends the same way. Importing/saving templates costs 0.
- **Save a sent email as a preset** — Decided list (step 10) and Activity (team): saves `outbound_messages.template_source` (the variable form), so the preset fills in per person next time, not one prospect's name.
**Copy rule:** system presets ship only after Roman has read them (`approvedAt` in presets.ts); the first library version is being reviewed. `renderSource()` still refuses any placeholder we can't fill from a verified fact. Tests: `tests/lib/templateLibrary.test.ts`.

## Customer list upload (2026-10-12)
Customers (step 7, and later) and the team (`/team/outbound` → Prospects → "Upload a CSV list") can import their own leads — B2C lanes whose buyers are consumers, and agencies running outreach for clients. Pure parsing/mapping/validation in `lib/outbound/csvImport.ts` (tests `tests/lib/csvImport.test.ts`); DB write in `lib/outbound/importProspects.ts`; UI `components/outbound/CsvImport.tsx`. Limits 2 MB / 5,000 rows. Mapping targets: name, email (required), company, phone, website, city, state, first/last name, custom (kept under the header in `outbound_prospects.custom_fields`), ignore. Prospect name = company when present, else the person (consumer leads: the person is the prospect and `contact_name`, so the greeting is "Hi First,"). Skipped + counted: invalid email, no name/company, duplicate in file, already on the list (email, or website domain when the row has one). Rows carry `source='upload'` + `import_id` → `outbound_imports` (filename, uploader, mapping, counts) — shown as an "Uploaded · filename" tag. Importing costs 0 credits; enrich (skipped when an email is already present), draft, approve follow the normal prices. Names: "Last, First" is stored as "First Last" at import and `firstName()` in templates.ts handles the comma form and strips trailing punctuation (live finding: "Hi Royce,,"). Step 10 drafts prospects that already have an email first and estimates them at the write price only (`planLaunch(…, withEmail)`), so an uploaded list of N leads shows N×2 credits, not N×4. Template note: the intro reads "…is the kind of business we work alongside" when no category is known — fine for B2B uploads; a consumer-facing template is not written yet (Rome's call).

## Hourly sync — what else it does now (gap fixes 2026-10-12, G6/G7/G9/G10/G12)
`runOutboundSync` per business, in order: **probeConnections** (G9: refreshes the owner's Gmail + Calendar tokens; on the transition to dead → owner alert `system_health` + email to the business owner "Your Gmail/Google Calendar connection needs attention"), **syncReplies** (G7: after the thread match, a second pass for mail from the prospect's own domain since our send — never for free-mail domains — recorded with `payload.match='domain'`), **advanceSequences**, **retryFailedSends** (G6: human-approved sends that failed ≥ 1 h ago and are < 14 days old are retried automatically while the owner's Gmail connection is `active`, cap 20 per business per run — so the customer copy "we'll retry once it's fixed" is now true), **remindPendingApprovals** (G10: drafts waiting ≥ 24 h → one bundled `approval_pending` alert per business, one `approval_reminder` event per draft so it never repeats). At the end, any per-business errors fire a `system_health` owner alert (G12; coalesced to one text per hour). The daily `plan-refill` cron is the watchdog for the hourly one: if `outbound_cron_settings.last_run_at` is > 2 h old it alerts `system_health` "Hourly outbound sync has stalled". `last_result` now also carries `retried, recovered, reminders, deadConnections`.

## Operate
- Pending approvals: `select count(*) from outbound_messages where status='pending_approval'`.
- Cron health: `select last_run_at, last_result from outbound_cron_settings`; `select * from cron.job where jobname='outbound-sync-hourly'`. Pause: `update outbound_cron_settings set enabled=false; select outbound_cron_schedule();`
- A send failed: `outbound_messages.error` has Gmail's message; "not connected" → owner reconnects Gmail in Integrations.

## Not in Phase 1
Customer-facing approval queue (Phase 2), LinkedIn channel, bounce webhooks (Gmail has none — bounces arrive as replies and are left to the human), reply classification / auto-drafted replies (agent drafts via `sfb_outbound_draft reply_thanks`).

## Editing help: activation, spend log, daily cap (2026-10-12)
Dark until the key exists; live the moment it does. No code change, no redeploy beyond Vercel's own env-change redeploy.
| Piece | Where |
|---|---|
| Key | `ANTHROPIC_API_KEY` in Vercel env (never in source/chat). `assistConfigured()` reads it per request. |
| Status the composer reads | `assistStatus(service)` (`lib/outbound/assistSpend.ts`) → `{ configured, capped, capCents, spentTodayCents, instructions }`. Not configured → `instructions: []` and `ComposePicker` renders no "Agent help" row. Configured + capped → buttons rendered **disabled** with "Paused until tomorrow". |
| Entry point for edits | `assistEditLogged(service, who, draft, instruction)` — order: configured? → under cap? → model call → **log** → return. Routes: `POST /api/team/outbound action=template_assist`, `POST /api/dashboard/onboarding action=template_assist`. Errors are `OutboundError` codes `assist_off` (503), `assist_capped` (503), `assist_failed` (502). |
| Spend log | `outbound_assist_calls` — one row per call: `business_id, user_id, actor_label, instruction, model, status (ok/error/capped), input_tokens, output_tokens, cost_cents, error, latency_ms, created_at`. Refused edits (guard tripped, provider error) are logged as `error` **with the tokens the provider billed**; cap refusals as `capped` with 0 tokens. View `outbound_assist_spend_by_business` sums per business. |
| Cost | `estimateCostCents` from `MODEL_PRICE_USD_PER_MTOK` (list price USD/MTok, dated in the file — the only place to change when the price or model moves). |
| Daily cap | `outbound_assist_settings.daily_cap_cents` (one row, id=1). Resets at **midnight America/New_York** (`dayStart`). Default **500 ($5.00) is a placeholder** until Roman sets it. `0` = no spend allowed. |
| Tests | `tests/lib/assistSpend.test.ts` (cost, day window incl. DST, cap decision, raw call with a fake provider returning usage). |

Operate:
- Turn on: set `ANTHROPIC_API_KEY` in Vercel → redeploy happens → open Write my own → buttons appear. Turn off: remove the key. Nothing else to touch.
- Set the cap: `update outbound_assist_settings set daily_cap_cents = <cents>, updated_at = now() where id = 1;`
- Today's spend: `select count(*), sum(cost_cents) from outbound_assist_calls where created_at >= date_trunc('day', now() at time zone 'America/New_York') at time zone 'America/New_York';`
- Per business: `select * from outbound_assist_spend_by_business order by cost_cents desc;`
- "Buttons vanished": either the key is gone from Vercel (`configured:false`) or the cap was hit (`status='capped'` rows today). The composer never shows an error for either.
- Migration: `supabase/migrations/20261012_assist_spend.sql`.


## Roofing pilot preset, send window, outcome follow-ups (2026-10-19, approved by Rome)
- **Preset `sfb_roofing_missed_calls`** (`lib/outbound/presets.ts`) — Rome's exact copy, `teamOnly: true`: offered only to businesses whose owner is a team owner (`isTeamBusiness` in library.ts); customers never see it and `resolveSource` refuses it for them. Requires `company` + `city` (refuses without a city). `{{years_phrase}}` → " for N years" only when the prospect's uploaded custom columns carry it (`yearsFromCustom`: "Years in business", "years", "Founded"…); otherwise the sentence reads without it.
- **Send window** (`lib/outbound/sendWindow.ts`, `SEND_WINDOWS`) — `roofing-pilot-2026-10-19`: Mon Oct 19, 6–9 PM ET, template `sfb_roofing_missed_calls` only. Before it opens, `sendApprovedMessage` holds an approved send (status stays `approved`, event `send_held`, UI notice). `releaseSendWindow` in the hourly sync sends held ones while the window is open (ticks at :15 UTC → 6:15 / 7:15 / 8:15 PM ET), oldest approval first, `RELEASE_CAP_PER_TICK` = 40 per business per tick. After the window nothing auto-releases; leftovers can be sent by hand. Only businesses with a `plan_key` are iterated by the sync. New windows: add a row to `SEND_WINDOWS`.
- **Outcome follow-ups** (`lib/crm/followupRules.ts`) — when the rep leaves "Follow up on" blank: no answer / voicemail → +2 days; interested / call back later → +3 days (call end route); demo marked completed while the lead isn't won → +3 days (meeting outcome route). The rep's own time always wins; skipped if an open follow-up is already scheduled ahead; auto follow-ups earn no points. Tests: `tests/lib/followupRules.test.ts`, `sendWindow.test.ts`, `roofingPreset.test.ts`.

## Bulk Start sequence (2026-10-21)
Prospects tab → Select / Select All (the shared multi-select circles) → bottom bar **Start sequence**. Confirm text states the count and cost (2 credits per drafted intro on client businesses; house/team businesses are free). API `POST /api/team/outbound {action:"bulk_start_sequence", prospect_ids:[≤25]}` — the client loops in chunks of 25; ids are checked to belong to the authorized business; ineligible prospects (no email / already in a sequence / unsubscribed — `lib/outbound/sequenceRules.ts startSequenceBlocker`) are reported with a reason, never dropped; stops at the first out-of-credits; drafts only, never sends.
