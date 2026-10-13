# SFB Agent — Standard Operating Procedure (the operating manual)

Written 2026-10-12 from the code as built (commit `619d059a` and earlier). Every process below has the same eight headings. Where no verification, retry or alert exists, it says **no check exists** — nothing here is aspirational. Tables, functions and files are named so anyone can open the code and confirm.

Conventions: "customer" = the paying business owner using `/dashboard`; "team" = SFB owners/reps in `/team`; "owner alert" = `alertOwners()` in `lib/notify/ownerAlerts.ts` (in-app + text + email per §9). Credits prices come from `CREDIT_PRICES` in `lib/agentProgram/config.ts` and nowhere else.

---

## 1. Post-payment onboarding, steps 1–11

**What it does.** Takes a customer from "paid" to "agent running" in eleven steps: profile → Gmail → Calendar → brand → capabilities → ideal customer → lead list → automations → done-for-you choice → first campaign → dashboard. Lives at `/dashboard/onboarding/<slug>`, state in `customer_onboarding` (one row per business: `confirmed_steps`, `step_data`, `dfy_choice`, `last_step`, `dismissed_at`, `completed_at`).

**Why.** The agent cannot do anything useful without a connected mailbox and calendar, a one-line offer and a list; the flow forces those in order and makes each later step derive from real stored state, so the checklist can never say "done" for something that isn't.

**How — step by step.** `lib/onboarding/flow.ts deriveOnboarding()` computes done/locked for every step on each render; `lib/onboarding/state.ts loadOnboarding()` reads the row (`ensureRow()` upserts it with `ignoreDuplicates` — a first-render race was found live and fixed that way). API: `POST /api/dashboard/onboarding` with `action` (`save`, `confirm`, `dismiss`, `brand_pull`, `brand_colors`, `icp_suggest`, `icp_save`, `leads_source`, `leads_remove`, `leads_accept`, `leads_import_preview`, `leads_import_commit`, `automations_preview`, `automations_activate`, `dfy_choose`, `dfy_checkout`, `campaign_status`, `campaign_launch`, `campaign_approve`, `campaign_reject`, `template_*`). Auth: `customerBusinessOrReason()` — signed-out → 401 "You're signed out — sign in again and retry."; signed in with no plan → 403 "No active membership."

| Step | Done when (deriveOnboarding) | Writes | External call | Credits |
|---|---|---|---|---|
| 1 Business profile | `confirmed_steps.1` set | `businesses.legal_name, website, primary_category, niche_tags, city, state, phone, services, outbound_offer_line, description` via `parseProfileInput` | none | 0 |
| 2 Connect Gmail (**hard gate**) | `integration_connections` row `provider='gmail'`, `owner_id = business.owner_id`, `status='active'` | by the OAuth callback (§10) | Google OAuth | 0 |
| 3 Connect Calendar (**hard gate**) | `crm_calendar_connections` row for `rep_id = owner_id` with `refresh_failed_at IS NULL` | by the OAuth callback (§10) | Google OAuth | 0 |
| 4 Brand assets | `businesses.brand_logo_url` set OR `confirmed_steps.4` | `brand_pull`: fetches the website (`fetchSite`), `resolveLogo`, `extractBrandColors` → `brand_colors`, `brand_logo_url`; logo upload → bucket `brand-assets/<businessId>/logo-<ts>.<ext>` | HTTP GET of the customer's own site | 0 |
| 5 Capabilities | `confirmed_steps.5` | toggles in `business_capabilities` (written by the step component), confirm row | none | 0 |
| 6 Ideal customer | `businesses.icp IS NOT NULL` | `icp_save` → `businesses.icp` `{industries[], locations[], size, notes, source}` (`parseIcpInput`; "Tampa, FL" kept whole by `parseLocations`) | none | 0 |
| 7 Lead list | `outbound_prospects` count > 0 **and** `confirmed_steps.7` | see §2 and §3 | Exa (search) | 0 |
| 8 Automations | an `outbound_sequences` row `status='active'` | `automations_activate` → upsert sequence "Default 3-step" with the chosen cadence (steady 0/3/7, quick 0/2/4, patient 0/5/12) | none | 0 |
| 9 Want us to run it? | `customer_onboarding.dfy_choice` set (`install` / `retainer_talk` / `self_serve`) | `dfy_choose` (retainer requires a real `demo_calls` row for this user, not cancelled); `dfy_checkout` → Stripe Checkout for the $8,000 install via `addon_purchases`; webhook `onDfyPurchased` sets `install`, opens an urgent team task, alerts owners | Stripe | 0 (dollars, not credits) |
| 10 First campaign | a prospect in `in_sequence/replied/booked` OR an out message `approved/sent` | see §4–§6 | site reads, Gmail | 2 / 2 / 5 |
| 11 Dashboard | `confirmed_steps.11` OR `completed_at` | `confirm` step 11 also sets `completed_at` | none | 0 |

Locks: steps 4–11 are locked until 2 and 3 are done; locked copy: "Connect Gmail and Google Calendar first — they power everything after this." `dismiss` ("Go to dashboard, finish later") is refused (409) until the gates pass. Welcome page `/agent/welcome` polls every 3 s for the provisioned business (no cap; after 20 ticks adds "Taking longer than usual? Email hello@sfbconnect.com and we'll finish it by hand.").

**How we check it's working.** Live run as a real paying customer on the production flow (done 2026-10-12 for all 11 steps, twice); `tests/lib/onboarding*.test.ts` pin `deriveOnboarding`, ICP parsing, cadences, launch planning. **No automated end-to-end check exists** — it is a human run with screenshots.

**How we check it's accurate.** Completion is derived from the rows that make a step true (connection rows, `businesses.icp`, prospect counts, sequence status), never from a flag the UI set — so "done" cannot drift from reality. Resume lands on the first not-done, unlocked step.

**How we confirm it was delivered.** The customer sees the progress header percentage and ticks; the team sees `customer_onboarding` (`select confirmed_steps, dfy_choice, completed_at from customer_onboarding`). `completed_at` is the delivery record.

**On success.** `completed_at` set; "Finish setup" nav and nudge disappear; the agent feed (§4) is live on the dashboard.

**On failure.** Step-level validation returns the exact copy in the table's code (e.g. "Business name is required.", "Add your website in step 1 first.", "Couldn't read <site> (<status>). Upload your logo instead.", "Set your ideal customer (step 6) first."). Brand pull failure degrades to manual upload. Google OAuth refusals are handled by §11. Stripe checkout failure → 502 "Checkout failed." and the customer stays on step 9 with nothing charged. **No retry exists** for any onboarding action; the customer re-clicks. Nothing in onboarding alerts the team except the DFY purchase and the Google gate.

---

## 2. Lead list building (agent-found B2B leads)

**What it does.** Turns the ideal-customer profile into a reviewed list of real businesses. Step 7 "Find matching businesses" → up to 25 candidates → the customer removes what doesn't fit → "Keep these" → rows in `outbound_prospects` with `status='sourced'`, `source='agent'`.

**Why.** Customers rarely have a list; the agent builds one from the open web, cheaply (about 4¢ per run) and with a human review before anyone is contacted.

**How — step by step** (`lib/onboarding/leads.ts`).
1. `icpQueries(icp)` = one query per industry × location, capped at 6 — e.g. `"home services company in Miami, FL"`.
2. For each query, **one Exa search** (`https://api.exa.ai/search`, `type: "auto"`, `category: "company"`, `numResults = max(4, ceil(25 / queries))`, 400 chars of page text, 9 s timeout). **Exa is the only upstream source.** No directories, no data providers, no scraping of Yelp/Google — directories are filtered *out*, never read.
3. `toCandidates()` drops: any URL matching the `JUNK` list (yelp, yellowpages, bbb, facebook, linkedin, instagram, angi, homeadvisor, thumbtack, houzz, nextdoor, google, wikipedia, indeed, glassdoor, zillow, realtor, mapquest, manta, chamberofcommerce, clutch, crunchbase, expertise, threebestrated); anything whose domain is the customer's own site; anything whose domain is already on this business's list (`canonical_domain`); a second result from the same domain in this run; titles under 2 characters. Title is cleaned of "| Home / Official site" suffixes. City/state come from the query's location.
4. First 25 survivors are stored in `customer_onboarding.step_data.7.candidates` (so a mid-review exit resumes with the same list). **This is why a run shows "24 of 25" or "25 of 27"** — the cut is the cap plus the filters above, not a quality score. There is no scoring, no verification of the business, and no size filter despite the ICP "size" field.
5. `leads_accept` → `acceptCandidates()` → `addProspect()` per row (name, website, city, state, category = the industry query); duplicates are reported as `duplicate`, never errors. 0 credits.

**How we check it's working.** Live run 2026-10-12 on the internal QA business (ICP: home services / medical practice / law firm × Miami, FL): 3 Exa queries, 27 raw, 25 kept, all real businesses with domains. `tests/lib/onboardingO2.test.ts` pins `toCandidates` (directories dropped, own domain excluded, dedupe by domain). Exa calls are logged to `discovery_search_calls` via `logSearchCall`.

**How we check it's accurate.** **No check exists** beyond the filters: a candidate is "a company Exa returned for that query with a non-directory domain". Franchise/national sites (e.g. `acehandymanservices.com`, `maidpro.com` appeared in the Miami run) are kept. Whether the business is open, local, or the right size is not verified at this step — the site read in §4 is the first real contact with the business.

**How we confirm it was delivered.** `outbound_prospects` rows with `source='agent'` and an `outbound_events` row `kind='sourced'` per prospect; step 7 shows "N businesses already on your list".

**On success.** Prospects in `sourced`; step 7 confirmed; nobody has been contacted.

**On failure.** No `EXA_API_KEY` → 503 "Lead search isn't configured (EXA_API_KEY)."; one query failing or timing out is skipped silently and the others continue (no alert); zero results → "Nothing found for that profile yet — widen the industries or add another city in step 6." **No retry, no alert** to the team.

### Client questions answered (plain words)

**"Where do the leads come from?"** From a web search (Exa) for your kind of customer in your cities — one search per industry and city, up to six. We keep only real company websites; directories and social pages are thrown away. We do not buy lists and we do not pull from Yelp or Google listings. *One-liner: "A fresh web search for your ideal customer in your area — real company sites only, no bought lists."*

**"Will it scrape the same lead twice?"** No. Every prospect is keyed on its **website domain** and its **email**; the database refuses a second row with either (`outbound_prospects_domain_key`, `outbound_prospects_email_key`). A new search is also told what's already on your list and never offers it again. **Proof (2026-10-12):** we accepted all 25 Miami results, ran the identical search again, and got 1 new candidate with **0 overlap**. Uploaded lists are checked the same way (by email, and by domain when a website is given). *One-liner: "Every lead is locked by website and email — the same business can't be added twice, from search or from a spreadsheet."* **Honest limits:** a business under two different domains is two leads; a person in an upload with no website is only deduped by email; a lead you removed during review isn't remembered and can reappear next search (gap G2).

**"How accurate is it?"** The list is a starting point, not a verified database. What can be wrong: closed businesses, stale or generic (info@) emails, changed sites, franchise pages. What catches it: before drafting, the agent reads the live website and only uses an email it actually finds there (nothing found → 0 credits, no draft); every draft waits for your approval; replies and unsubscribes stop sequences. What **doesn't** exist today: email deliverability checks (shape only), bounce detection (Gmail has no bounce webhook — bounces arrive as replies for a human to read), closed-business detection beyond "the site didn't load". *One-liner: "The agent finds candidates and reads their live site before it writes; you approve every email; if a site is dead or has no contact, nothing is sent and nothing is charged."*

---

## 3. CSV list import

**What it does.** Lets a customer bring their own leads (B2C lists, agency client lists) on step 7 or the team Prospects tab: upload → map columns → preview → import with honest counts. `components/outbound/CsvImport.tsx`, `lib/outbound/csvImport.ts` (pure), `lib/outbound/importProspects.ts` (DB).

**Why.** Built-in prospecting only finds businesses; consumers and existing client lists need a door in — through the same dedupe, approval and credit rules.

**How.** `parseCsv` (BOM, quoted commas, doubled quotes, ragged rows, delimiter auto-detect; ≤ 2 MB, ≤ 5,000 rows) → `suggestMapping` (headers normalised to lowercase alphanumerics; `E-Mail Address` → email, `Company Name` → company, unknown → custom field) → `validateMapping` (needs an email column and a name/company column; no double mapping) → `buildRows` (invalid email, no name, duplicate-in-file skipped and counted; `Last, First` → `First Last`; extra columns kept in `custom_fields`) → `importProspects` writes `outbound_imports` (filename, uploader, mapping, counts) and one `addProspect()` per row with `source='upload'`, `import_id`, `email_source='upload'`, skipping rows whose email or website domain already exists (`duplicate_existing`). 0 credits.

**How we check it's working.** `tests/lib/csvImport.test.ts`; live 2026-10-12: messy 6-row file → 3 imported / 3 skipped with reasons; same file again → 0 imported / 6 skipped, 3 `duplicate_existing`.

**How we check it's accurate.** Email is shape-checked (`^[^\s@]+@[^\s@]+\.[^\s@]{2,}$`) only — **no deliverability check exists**. Names are not validated beyond non-empty.

**How we confirm it was delivered.** The report on screen (imported / skipped by reason with examples); `outbound_imports.counts`; "Uploaded · filename" tag on each prospect; `step_data.7.imports`.

**On success.** Prospects in `sourced` with an email, so step 10 drafts them without a site read (2 credits instead of 4); step 7 confirmed when ≥ 1 imported.

**On failure.** Over 2 MB → "That file is over 2 MB — split it and upload in parts."; no header/rows → "We couldn't find a header row and at least one lead in that file."; mapping errors name the fix. A row that fails to insert is counted under `error` with the message. **No retry; no alert.**

---

## 4. Campaign launch (step 10 / Start sequence)

**What it does.** Takes the next ≤ 10 uncontacted prospects, finds an email where missing, and writes each a first email into the approval queue. Nothing sends here.

**Why.** Metered, reviewable work in small batches the balance can afford.

**How.** `lib/onboarding/campaignRun.ts launchCampaign()`: prospects with status `sourced`/`enriched`, those **with an email first**; `planLaunch(available, balance, 10, withEmail)` sizes the batch so the ledger can never go negative (emailed rows cost `write` only, others `enrich + write`). Per prospect: if no email → `enrichProspect()` (reads home + contact page with `fetchSite`, extracts mailto/visible emails and phones, `pickEmail` prefers the prospect's own domain; writes `enrichment`, `email`, `email_source` = `mailto`/`visible`; **2 credits if something was found, 0-credit receipt if not**) → `startSequence()` → `draftMessage()` with the business's intro (`introTemplateFor`: explicit pick in `businesses.outbound_intro_template`, else `recommendIntro` — consumer when > 50 % of uncontacted prospects are people or the ICP reads consumer) or a one-off compose (preset / `saved:<id>` / `custom`) → `renderSource()` refuses any template whose required fact is missing (e.g. no `offer_line`) → `outbound_messages` row `status='pending_approval'` with `template_key` and `template_source` → **2 credits** (`outbound.message_written`, idempotency `outbound:<msg>:write`) → event `approval_requested` → owner alert `approval_pending` (coalesced to one text per person per 10 min). Follow-ups are drafted later by the cron (§7).

**How we check it's working.** Live 2026-10-12 several times (business and consumer intros, custom email, saved preset); `tests/lib/campaign.test.ts` (plan math), `tests/lib/templateLibrary.test.ts` (every preset renders, no stray braces, consumer presets never say "company").

**How we check it's accurate.** Templates are deterministic — no model writes outreach; every placeholder is a stored fact or the sender's profile; an unknown placeholder throws. Email choice: own-domain first. **No check exists** that the found email is monitored or current.

**How we confirm it was delivered.** Queue shows "N waiting" with template labels; `outbound_messages` rows; ledger receipts; owner in-app notification.

**On success.** Drafts in the queue; prospects → `in_sequence`; balance reduced by exactly the receipts.

**On failure.** No website and no email → `no_website` (0 credits); site read finds nothing → `no_email` (0-credit receipt "nothing public found"); `offer_line` missing → `missing_facts` and the UI points at step 1; out of credits → the batch stops at that prospect with `paused` and the customer sees the top-up card ("Nothing is lost…"). Launch itself has **no retry**; re-clicking continues with the next uncontacted prospects. Fetch errors on the prospect's site are treated as "nothing found", not alerted.

---

## 5. Approval queue

**What it does.** The human gate. Every outbound email sits in `pending_approval` until a person approves or rejects it — on step 10 (customer) or `/team/outbound` (team). Same rows, same queue.

**Why.** Rome's rule: nothing customer-facing leaves without a human. It is also the moment the 5-credit review pass is charged.

**How.** `approveMessage()` (`lib/outbound/engine.ts`): allowed for a team owner, the business owner, or the business's `agent_overseer_id`; optimistic lock (`update … where status='pending_approval'`, else 409 "Message was changed by someone else — reload."); sets `status='approved', approved_by, approved_at`; charges **5 credits** `human.review_pass` (idempotency `outbound:<msg>:approve`, `approved_by` on the receipt); event `approved`; then `sendApprovedMessage()` if Gmail is connected (`andSend`), else the row waits as `approved`. `rejectMessage()` → `status='rejected'`, `rejected_reason` (default "Not this one" from step 10, prompt text from the team UI), event `rejected`; no charge. Customer path: `campaign_approve` (`ids` or `"all"`), `campaign_reject`.

**How we check it's working.** Live many times 2026-10-12 (customer and team sides; the two queues are provably the same rows — Roman approved from `/team/outbound` while a customer test was running). Approve-button label defect found and fixed same day (`0a2fd809`).

**How we check it's accurate.** The reviewer reads the exact subject/body that will send (`body_text` is final; only the unsubscribe footer and tracking pixel are appended at send). **No check exists** that the reviewer actually read it — a click is an approval.

**How we confirm it was delivered.** `approved_by/approved_at` on the row; a `−5` ledger row with `approved_by`; `approved` event in the feed with "Human approved" badge.

**On success.** Row `approved` → §6 send (or waits for Gmail).

**On failure.** Wrong role → 403 "Only the business owner, its overseer, or a team owner can approve."; already decided → "Message is <status>, not pending approval."; out of credits at approval → `InsufficientCreditsError`, nothing approved, nothing charged, the batch stops (`paused`). **No retry needed**; the row stays pending. Owners are reminded only by the original `approval_pending` alert — **no "still waiting" reminder exists.**

---

## 6. Sending (Gmail)

**What it does.** Delivers an approved email from the business owner's connected Gmail, with a one-click unsubscribe link and an open pixel.

**Why.** Deliverability and trust: mail comes from the customer's real mailbox, not a bulk sender; the unsubscribe is real and immediate.

**How.** `sendApprovedMessage()`: load message + business → suppression check (`outbound_suppressions`) → `canSend()` gate (`lib/outbound/gate.ts`: `direction='out'`, `status='approved'`, `approved_by` **and** `approved_at` present, recipient email shape valid, not suppressed) → `workAllowed()` (plan present, balance > 0) → footer `unsubscribeFooter(url)` with token `HMAC-SHA256(messageId:businessId, CALENDAR_TOKEN_ENCRYPTION_KEY)[0:40]` and pixel `/api/outbound/o/<id>.gif` → `sendGmail(owner_id, …)` (`lib/integrations/gmail.ts`: multipart text+HTML, `Subject` RFC 2047-encoded when non-ASCII, `threadId`/`In-Reply-To` for follow-ups; token refreshed by `getAccessToken` if within 60 s of expiry). **Sending costs 0 credits.**

**How we check it's working.** Live sends 2026-10-12 from `sfbconnects@gmail.com` with headers read back through the Gmail API (`From: SFB CONNECTS <sfbconnects@gmail.com>`, `Received: … gmailapi.google.com`); `tests/lib/outbound.test.ts` pins `canSend` and the gate reasons; `tests/lib/gmailHeaders.test.ts` pins the Subject encoding.

**How we check it's accurate.** The Gmail API's own response (`id`, `threadId`, `labelIds: [SENT]`) is stored — that is Gmail confirming it accepted the message. **No check exists** for delivery to the inbox (no bounce webhook; Gmail provides none), no DMARC/SPF monitoring.

**How we confirm it was delivered.** `outbound_messages.status='sent'`, `sent_at`, `gmail_message_id`, `gmail_thread_id`; `outbound_prospects.last_contacted_at`; event `sent` → feed "Sent to <prospect>"; `gmail.sent` integration event. Opens: `recordOpen()` sets `opened_at` once and counts `open_count` — a hint, not proof.

**On success.** Prospect stays `in_sequence`; the cron schedules follow-ups off `sent_at`.

**On failure.** `status='failed'`, `error` (first 500 chars of Gmail's message), event `failed`; customer sees `friendlyFail()`: "Connect Gmail and this sends." / "Gmail refused the send — reconnect Gmail in Integrations." / "Couldn't send — your Gmail connection needs attention; we'll retry once it's fixed." Team sees the red "N approved messages failed to send" banner with **Retry send** (`retryFailedSend`: keeps the approval, resets to `approved`, re-runs the gate and send). **There is no automatic retry** despite the customer copy saying "we'll retry once it's fixed" — retry is the team's button (gap G6). Gate refusals (`gate_<reason>`) are 409s and are not alerted.

---

## 7. Reply detection and sequence advance (hourly cron)

**What it does.** Every hour at :15 UTC, for every business with a plan: looks for replies to sent emails and drafts the next due sequence step into the approval queue.

**Why.** Follow-ups must stop the moment someone answers, and must never send without a fresh approval.

**How.** pg_cron `outbound-sync-hourly` (`15 * * * *`) → `POST /api/cron/outbound-sync` (auth: SHA-256 of the Vault token vs `outbound_cron_settings.cron_token_hash`, or `CRON_SECRET`; timing-safe) → `runOutboundSync`: per business `syncReplies()` then `advanceSequences()` (actor `cron`); per-business errors are collected, others continue; result in `outbound_cron_settings.last_run_at/last_result`.
- `syncReplies`: for the last 50 `sent` messages with a `gmail_thread_id` and no `replied_at`, `listGmailMessages(owner, q: "from:<to_email> newer_than:30d", max 5)`; a message in the same thread that isn't ours = a reply → insert `outbound_messages` `direction='in', status='received', in_reply_to` (body up to 20,000 chars), set `replied_at`, prospect → `replied`, event `replied`. 0 credits.
- `advanceSequences`: prospects `in_sequence`; clock starts at the first `sent` message's `sent_at`; `dueSteps` = steps whose `day ≤ elapsed days` and not yet drafted; each due step → `draftMessage()` (2 credits, pending approval) using `resolveStepTemplate(step, introKey)` (consumer intro → consumer follow-ups). Stops when the prospect is no longer `in_sequence` (replied / unsubscribed / booked), the sequence isn't `active`, or credits run out (skipped, surfaced in events).

**How we check it's working.** `select last_run_at, last_result from outbound_cron_settings` (last run 2026-10-12 20:15Z: `{businesses:1, replies:0, drafted:0, errors:[]}`); `cron.job_run_details` shows `succeeded`. `tests/lib/outbound.test.ts` pins `dueSteps`.

**How we check it's accurate.** Reply match is by **Gmail thread id**, not by text — a prospect replying from a different address or a fresh thread is **not detected** (gap G7). **No check exists** for out-of-office or bounce classification; both land as "replies" for a human.

**How we confirm it was delivered.** `received` rows and `replied` events in the feed ("<prospect> replied"); drafted follow-ups appear in the queue with their step.

**On success.** Replies stop the sequence; follow-ups wait for approval.

**On failure.** Cron auth failure → 401, nothing runs, **no alert**; a business whose Gmail token is dead → its `syncReplies` is skipped (`catch { continue }`) and the error string lands in `last_result.errors` — **nobody is alerted**; the drafts still advance (and will fail to send later with the friendly copy). **No retry inside the hour**; the next run picks up.

---

## 8. Credit ledger

**What it does.** The single source of truth for what the agent may do: an append-only `credit_transactions` ledger; balance = `sum(amount)`; every metered action writes a receipt.

**Why.** Rome's rule: credits pay for work done, failed work costs 0, the ledger can never go negative, and every charge is visible to the customer.

**How.** Prices: `CREDIT_PRICES` (enrich 2, write 2, review 5, meeting 5 …). Grants: `provisionAgentCustomer` on `checkout.session.completed` (`PURCHASE`, tier credits, `credits_cycle_started_at = now()`); monthly `invoice.paid` with `billing_reason='subscription_cycle'` → `expireUnspentAllotment()` (writes `EXPIRATION` for unused allotment; top-ups untouched) then `PURCHASE`; annual plans refilled by pg_cron `billing-plan-refill-daily` (`30 6 * * *`) when a month has passed; top-ups `credit_packages` 100/$149, 500/$599, 1,000/$999 → `PURCHASE`. Spend: only `spend_credits()` (SQL, `security definer`, service-role only): `pg_advisory_xact_lock` per business, idempotency key checked before and after the lock, balance re-read under the lock, `INSUFFICIENT` raised with nothing written, `USAGE` row with negative amount (0-cost rows allowed as receipts). Display: `get_credit_breakdown()` derives `monthly_spent / monthly_remaining / topup_balance` from the ledger. Guards: `workAllowed()` (plan present, balance > 0); `chargeAction()` sets `businesses.work_paused_reason='out_of_credits'` on `INSUFFICIENT` and throws. Thresholds after every charge (`notifyCreditThresholds`): 80 % → customer email + owner alert `credits_warning`; 95 % → same, "critical"; 0 → customer email + overseer email "Agent paused — <name> is out of credits" + owner alert `credits_exhausted`; each level once per cycle (`businesses.credit_alerts_sent`). Refunds: `charge.refunded` on a credit pack claws back `min(pack credits, balance)` as `REFUND` — never below 0. Webhook idempotency: `stripe_webhook_events` unique on `stripe_event_id`.

**How we check it's working.** `tests/lib/creditEconomy.test.ts` pins prices and `splitBalance`; live 2026-10-12: every launch/approve produced exactly the expected receipts (150→146→…→123) and the breakdown matched. Runbook `credit-ledger.md`.

**How we check it's accurate.** Balance is never stored, only summed; `balance_after` on each row is a display snapshot. Reconciliation: `select sum(amount) from credit_transactions where business_id=…` must equal the dashboard. **No automated reconciliation job exists.**

**How we confirm it was delivered.** Every receipt is visible on the customer's Credits tab and in the agent feed ("−5 cr", "0 credits"); `billing_audit_log` records grants, refunds, plan ends.

**On success.** Work proceeds; alerts fire once per level.

**On failure.** `INSUFFICIENT` → nothing written, agent paused, top-up prompt on step 10, owner + overseer told. Resume: renewal and annual refill clear `work_paused_reason`; **a top-up purchase raises the balance (so `workAllowed` passes and work resumes) but does not clear `work_paused_reason`**, so the dashboard keeps showing the agent as paused until the next renewal (gap G8). Stripe webhook errors return non-200 so Stripe retries on its schedule; a duplicate event is deduped. `ADJUSTMENT`/`REVERSAL` types exist in the enum with **no code path** that writes them.

---

## 9. Owner notifications (in-app, text, email)

**What it does.** Tells the team when a human is needed: `lead_new`, `demo_booked`, `callback_sla` (the 5-minute call-now promise), `credits_warning`, `credits_exhausted`, `approval_pending`, `sms_test`. Text = email to the carrier's email-to-SMS gateway via Resend (no Twilio).

**Why.** The approval queue only works if owners hear about it; the callback promise is a real commitment.

**How** (`lib/notify/ownerAlerts.ts alertOwners`, `lib/notify/sms.ts`). Recipients: all `team_role='owner'` users (plus the business's overseer for approvals). Per recipient `decideChannels()`: pref off → skipped (except `callback_sla`, which can't be turned off); no phone / no carrier / carrier shut down (AT&T + Cricket since 2025-06-17) / bounce in the last 7 days → email fallback; gateway available but **unverified** → text **and** email (`unverified_sms`); verified → text only; `callback_sla` → always email too (`critical`). Text body: ASCII, split into ≤160-char parts `(i/n)`, sent via `sendGatewaySms` with empty subject. Before each text, `reconcileLastSms` asks Resend for the previous text's `last_event` and records a bounce. `approval_pending` is coalesced: one text per person per 10 minutes (`COALESCE_MINUTES`); in-app every time. In-app → `crm_notifications`; every attempt → `notification_deliveries` (`channel`, `to_address`, `status ∈ sent/failed/skipped/fallback/coalesced`, `reason`, `provider_id`).

**How we check it's working.** Live 2026-10-12: `demo_booked`, `approval_pending`, `lead_new`, `callback_sla` all produced the expected `notification_deliveries` rows (text 1/1 to Roman's Verizon gateway, email fallback for Muse who has no phone). Settings → Text alerts → **Send test** + "I received it" verifies a phone.

**How we check it's accurate.** Only the recipient can confirm a text arrived ("I received it" sets `notify_sms_verified_at`); until then every text is mirrored by email. Resend's `last_event` catches gateway bounces. **No check exists** that the carrier actually delivered a "delivered" email to the handset (T-Mobile gateways are unreliable; Verizon sunsets by 2027-03-31).

**How we confirm it was delivered.** `select trigger, channel, status, reason from notification_deliveries order by created_at desc`; the bell in the team app.

**On success.** Owners see in-app, text (if verified) and/or email.

**On failure.** Resend error or missing `RESEND_API_KEY` → `failed`/`skipped` row with the reason; the text path falls back to email once; **no retry, no escalation** — if Resend is down, the only surviving signal is the in-app notification. Task creation for Google clearance / DFY handoff failing is logged to console only.

---

## 10. Gmail and Google Calendar integrations

**What it does.** Connects the business owner's Google account so the agent can send from their Gmail, read replies, check availability and book meetings with Meet links. Since 2026-10-12 the SFB-side owner connection is **sfbconnects@gmail.com** for both.

**Why.** Mail from the customer's own domain/mailbox; meetings on the calendar they actually look at.

**How.** OAuth starts at `/api/team/integrations/gmail/connect` (scopes `gmail.send`, `gmail.modify`, `userinfo.email`; `access_type=offline`, `prompt=consent`) and `/api/team/integrations/google/connect` (Calendar: `calendar`, `userinfo.email`); both share the registered redirect `GOOGLE_OAUTH_REDIRECT_URI` → `/api/team/integrations/google/callback`, which routes by state cookie (`oauth_state_gmail` vs `google_oauth_state`). Customers reach these with `?return=onboarding|dashboard` and are refused unless cleared (§11); team members are never gated. Tokens: AES-256-GCM with `CALENDAR_TOKEN_ENCRYPTION_KEY` (`lib/crm/tokenCrypto.ts`); Gmail in `integration_connections` (`provider='gmail'`, `account_label` = the Google email from `userinfo`, `status`, `last_error`); Calendar in `crm_calendar_connections` (`google_email`, `refresh_failed_at`, `refresh_error`). A connection without a refresh token is refused ("Google didn't return a refresh token…"). Access tokens are refreshed when within 60 s of expiry (`getAccessToken`, `getValidAccessToken`). Calendar use: `getBusyBlocks` (free/busy on `primary`), `createCalendarEvent` (with `conferenceData` → Meet link, attendees, `sendUpdates=all` for demo calls; **a missing Meet URL is returned as null, never invented**), `deleteCalendarEvent` (410 treated as success). Disconnect deletes the row (tokens gone immediately).

**How we check it's working.** Integrations grid shows the account label; live 2026-10-12: send headers `From: sfbconnects@gmail.com`, inbox listing for reply sync, demo booking created an event with `organizer: sfbconnects@gmail.com` and a Meet link, cancel removed it. `integration_provider_verifications` records the first successful connection per provider.

**How we check it's accurate.** The account shown is what Google returned at connect time (`userinfo.email`), not typed by anyone. Token health: a failed refresh writes `status='error'/last_error` (Gmail) or `refresh_failed_at/refresh_error` (Calendar) and the card shows "Needs reconnect". **No proactive health check exists** — a dead token is discovered on the next send/booking.

**How we confirm it was delivered.** Gmail API's `id/threadId` for sends; Calendar's `eventId/htmlLink/meetUrl` stored on `demo_calls` / `outbound_bookings`.

**On success.** Steps 2–3 derive as done; sends and bookings work.

**On failure.** Dead refresh token → the next send fails with "Gmail refused the send — reconnect Gmail in Integrations." / `GoogleAuthExpiredError` "Google Calendar access has expired or was revoked. Reconnect it from Integrations." — the human reconnects; **no automatic reconnect or alert on token death.** OAuth cancelled → "Google connection was cancelled." State mismatch → "Google sign-in couldn't be verified — please try connecting again." Google `access_denied` for a customer → §11.

---

## 11. Google test-user gate

**What it does.** Keeps paying customers from ever seeing Google's "Access blocked" page while the OAuth app is in testing mode (bridge strategy; **do not publish the app to "fix" this**). A customer submits their Google address → the team adds it as a test user in Cloud Console (project `612333806040`) → marks it cleared → the Connect button appears.

**Why.** Gmail's `gmail.modify` is a restricted scope; publishing without Google verification breaks every connection. Testing mode allows 100 test users.

**How** (`lib/google/gate.ts`, `lib/google/clearance.ts`). Status machine on `google_clearances` (one row per business): `not_started → email_submitted → cleared → connected`. `submitEmail` (customer, `POST /api/dashboard/google-gate`): upsert row, event `email_submitted`, create team task "Clear Google test user: <email>", owner alert (`lead_new`) with the console link. `markCleared` (team, `POST /api/team/google-gate action=mark_cleared`, owner only): refused if blocked; sets `cleared/cleared_at/cleared_by`, event `cleared`, emails the customer "Your Google account is cleared — connect it now", runs `afterCountChange`. Connect routes refuse customers unless `cleared/connected` (`canStartGoogleOAuth`) and redirect back with `CUSTOMER_WAITING_COPY`. OAuth callbacks: success → `markConnected` (row → `connected`, counter +1); `access_denied` → `recordAccessDenied` (`denied_count`+1, event, owner alert `callback_sla` "Google BLOCKED a customer…") and the customer lands on `/dashboard/google-not-cleared` with `CUSTOMER_DENIED_COPY` — Google's text is never shown. Counter = rows `cleared + connected`; alerts at 70/85/95 once each (`google_gate_state.alerts_fired`), **block at 95** (and a manual block switch), verification task created once at 20.

**How we check it's working.** Live 2026-10-12: submit → task + alerts; connect refused before clearing (server-side, not just hidden); forced `access_denied` → holding page + alert; real **Mark cleared** click → row cleared by Roman, counter 0→1, customer email. Thresholds are unit-tested only (`tests/lib/googleGate.test.ts`) — **not exercised live** (needs 20–95 businesses).

**How we check it's accurate.** The counter is derived from rows, but **the console's real tester list is not read** — if a human marks cleared without adding the address, the customer hits `access_denied` and the backstop alert fires; that is the only check (gap G11).

**How we confirm it was delivered.** `google_clearances.status='connected'` after a successful OAuth; `google_gate_events` is the audit trail; the team panel shows "Google test users: N / 100".

**On success.** Customer connects Gmail/Calendar; steps 2–3 unlock 4–11.

**On failure.** Team never acts → the customer waits with "usually done within a few hours" copy and **nothing re-alerts the team** (one alert + one task). Blocked at 95 → customers see `CUSTOMER_BLOCKED_COPY`; `markCleared` returns 409. Alert send failures are not retried; a threshold whose alert threw stays unmarked and re-fires next count change.

---

## 12. Gap register (what has no check, no retry, or no mitigation today)

Seven small gaps (G2, G6, G7, G8, G9, G10, G12) were fixed on 2026-10-12 and are marked FIXED below; the sections above describe the code **before** those fixes where they say "no retry" — read the fix rows as the current truth.

| # | Gap | Where it bites | Proposed fix | Size |
|---|---|---|---|---|
| G1 | Lead quality is unverified at sourcing: franchise/national domains kept; ICP "size" ignored; no open/closed check | §2 | Filter known franchise domains; optional "exclude national brands"; show "last seen" from the site read | S–M |
| G2 | **FIXED 2026-10-12** — removed candidates kept in `step_data.7.excluded`, passed to `sourceCandidates` | §2 | — | done |
| G3 | Dedup has no name+city key; same business under two domains = two leads; uploaded people without websites dedupe by email only | §2–3 | Add a normalised `name+city` soft-match warning at import/accept (not a hard key) | M |
| G4 | Email is shape-checked only; no MX/deliverability check; no bounce detection (Gmail has no webhook) | §3, §4, §6 | MX lookup at import/enrich (free); parse Gmail "Delivery Status Notification" replies in `syncReplies` → mark `bounced` + suppress | M |
| G5 | Resend failures are logged, never retried; if Resend is down, only in-app survives | §9 | Queue failed deliveries in `notification_deliveries` and retry on the hourly cron | M |
| G6 | **FIXED 2026-10-12** — `retryFailedSends` on the hourly cron (approved, failed ≥ 1 h, < 14 d, Gmail active, cap 20) | §6 | — | done |
| G7 | **FIXED 2026-10-12** — second-pass domain match in `syncReplies` (never free-mail), `payload.match='domain'` | §7 | — | done |
| G8 | **FIXED 2026-10-12** — webhook clears `work_paused_reason` after a top-up when balance > 0 | §8 | — | done |
| G9 | **FIXED 2026-10-12** — `probeConnections` hourly; alert on transition to dead + customer email | §10 | — | done |
| G10 | **FIXED 2026-10-12** — `remindPendingApprovals` at 24 h, one bundled alert per business | §5 | — | done |
| G11 | Gate counter trusts the human; the console's tester list isn't read | §11 | None available by API (Google offers no tester-list API); keep the backstop alert | — |
| G12 | **FIXED 2026-10-12** — `system_health` alert on run errors; daily watchdog for a stalled hourly sync | §7 | — | done |
| G13 | No automated end-to-end test of onboarding; all acceptance is human | §1 | Playwright smoke on a QA business after each deploy | L |
| G14 | AI Presence engine is off; its price list exists; `score_refresh` at 2 credits would run at a loss on top-ups | — | See the unit-economics doc; price per weekly pass before enabling | S |
| G15 | Lead sourcing, sequence build and reply drafting are in `CREDIT_PRICES` but never charged / not built | §2, §4 | Decide: charge them or remove the lines | S |

---

## Appendix — where to look

| Question | Query / place |
|---|---|
| Is a customer's onboarding done? | `select confirmed_steps, dfy_choice, completed_at, dismissed_at from customer_onboarding where business_id=…` |
| What's waiting for approval? | `select count(*) from outbound_messages where status='pending_approval'` or `/team/outbound` |
| Why did a send fail? | `select error from outbound_messages where id=…`; feed shows the friendly version |
| Did the cron run? | `select last_run_at, last_result from outbound_cron_settings`; `select * from cron.job_run_details order by start_time desc limit 10` |
| Does the balance tie out? | `select sum(amount) from credit_transactions where business_id=…` vs `get_credit_breakdown(…)` |
| Did the owner get the text? | `select * from notification_deliveries where trigger=… order by created_at desc` |
| Which Google account is connected? | `select provider, account_label, status from integration_connections`; `select google_email, refresh_failed_at from crm_calendar_connections` |
| Gate state | `/team/integrations` panel; `select * from google_clearances`; `select * from google_gate_state` |

Related runbooks: `docs/runbooks/onboarding-post-payment.md`, `outbound.md`, `credit-ledger.md`, `owner-sms-alerts.md`, `integrations.md`, `google-gate.md`, `demo-call.md`, `analytics.md`.
