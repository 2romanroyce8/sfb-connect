# SFB Connect — Runbooks & Handover

Everything here is written so Atlas (Muse) or any engineer can operate SFB Connect without HyperAgent present. One rule: **nothing ships without a runbook in this folder.**

## Repo & access map
| Thing | Where | Who has access |
|---|---|---|
| Source | GitHub `2romanroyce8/sfb-connect`, branch `main` | Roman (owner); HyperAgent via GitHub connector; Muse via its own GitHub access if granted |
| Hosting / deploys | Vercel project for sfbconnect.com, auto-deploys `main` | Roman's Vercel account |
| Database / auth / storage | Supabase project `jisyhitqusdzfdscvbtb` ("SFBv2") | Roman; HyperAgent via Supabase connector |
| Payments | Stripe account (keys set in Vercel env) | Roman |
| Domain / DNS | Cloudflare (sfbconnect.com) | Roman |
| Team app | https://www.sfbconnect.com/team (owner: Roman; owner teammate login: muse@sfbconnect.com) | team |
| Agent connector | https://www.sfbconnect.com/api/v1/agent/mcp (OAuth; Settings → Connected Agents) | Muse (atlas), Hyperagent |

## Deploy runbook (every path)
1. Change code → `npx tsc --noEmit` → `npm test` (170+ tests) → `npx next build`.
2. Commit to `main` (small, explained commits; migrations also committed under `supabase/migrations/`). Vercel deploys automatically; live when `buildId` in the HTML of `/team/login` changes (≈2–4 min).
3. Database changes: apply the migration to Supabase (SQL editor or the Supabase connector) **and** commit the same SQL file. Never apply SQL that isn't committed.
4. Verify live, as the real user, with real data. A 200 proves nothing.
5. Rollback: revert the commit on `main` (Vercel redeploys); for data, the Danger Zone deletion log and `crm_data_deletion_log` snapshots are the recovery path.

## Secrets inventory (names and locations only — values live only in Vercel/Supabase)
| Secret | Where set | Used by | Rotation |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel env | app (public) | rotate in Supabase → update Vercel → redeploy |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel env | server routes, webhooks, agent layer | same; high sensitivity |
| `CALENDAR_TOKEN_ENCRYPTION_KEY` | Vercel env | encrypts Google tokens and delegated agent sessions | rotating invalidates stored tokens — re-connect calendar, agents re-authorize |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Vercel env (**live since 2026-10-11**) | checkout + webhook + $1 trial | rotate in Stripe → update Vercel → redeploy |
| `EXA_API_KEY` | Vercel env | research discovery | Exa dashboard |
| `GOOGLE_CLIENT_ID/SECRET` | Vercel env (**not yet set**) | Calendar + Meet | Google Cloud console |
| `ANTHROPIC_API_KEY` | Vercel env (**not set** — post-launch activation) | editing help in the composer (`lib/outbound/assist.ts`); buttons hidden until set, every call logged in `outbound_assist_calls`, daily cap in `outbound_assist_settings` — see outbound.md | Anthropic console |
| Other AI provider keys (`OPENAI_API_KEY` / `GEMINI_API_KEY`) | Vercel env (**not set**) | future Sales Assistant, AI visibility | provider dashboards |
| Agent OAuth tokens | `agent_tokens` (SHA-256 hashes only) | connector | revoke in Settings → Connected Agents |
Never paste a secret into chat, code, logs, or a task result.

## Spikes (decisions backed by evidence)
- [2026-10-11 Muse conversation sync](../spikes/2026-10-11-muse-conversation-sync.md) — no public API to read/post a user's Muse conversations; connect is outward-only.

## Operating manual
**`docs/sop/sfb-agent-sop.md`** — the SOP for everything the agent does (onboarding 1–11, lead list, CSV import, campaign launch, approval queue, sending, reply detection, credit ledger, owner notifications, Gmail/Calendar, Google gate), eight headings per process, written from the code as built, with a gap register. Read it first; the runbooks below are the per-area detail.

## Runbooks
- [client-projects.md](./client-projects.md) — client project graph (/team/projects; client mirror after Phase 2)
- [owner-sms-alerts.md](./owner-sms-alerts.md) — owner text alerts via carrier email-to-SMS through Resend: carrier reality, routing rules, triggers, delivery log
- [demo-call.md](./demo-call.md) — Book a demo call: ET slots from Rome's calendar, Meet + invite, .ics/vCard, 15–30-minute call-now alert
- [google-gate.md](./google-gate.md) — Google testing-mode bridge: gated Connect button, tester-list clearance flow, 100-cap alerts, access_denied backstop. App stays in testing mode on purpose.
- [guided-tours.md](./guided-tours.md) — data-driven tour engine over onboarding + dashboard: definitions, anchors, auto-start, analytics without PII
- [onboarding-post-payment.md](./onboarding-post-payment.md) — thank-you page + 11-step onboarding after payment: gates, derivation rules, resume, operate
- [onboarding-funnel.md](./onboarding-funnel.md) — gated funnel: account → email code → build show → pricing → pay (no trial)
- [agent-connector.md](./agent-connector.md) — OAuth tokens, 120 s refresh grace window, self-healing delegated sessions, audit log reading
- [agent-task-queue.md](./agent-task-queue.md) — Atlas ↔ HyperAgent task queue
- [agent-program.md](./agent-program.md) — tiers, 8 capabilities, trial sandbox, dashboard
- [credit-ledger.md](./credit-ledger.md) — ledger rules, guards, charging actions
- [checkout.md](./checkout.md) — Stripe setup, paths, failure modes
- [outbound.md](./outbound.md) — Outbound / GTM: enrich → write → human approval → send → track → book, credits, cron, agent tools
- [pricing-page.md](./pricing-page.md) — /pricing single source of truth, Rome's blanks, annual billing + monthly refill cron
- [legal-pages.md](./legal-pages.md) — Privacy/Terms drafts, open items, how they publish
- Integrations registry: `lib/integrations/registry.ts` is the single source for the homepage "Plugs into your stack" strip, the #agent row and the team Integrations page audit list. Marketing shows only `live` entries; Stripe flips to live automatically when its keys are set. Add an integration there with status `planned` first; flip to `live` only when its connect flow works.
- [integrations.md](./integrations.md) — registry, OAuth connect flows, Apple CalDAV, webhooks in/out, Zapier, Gmail
- [research-adapters.md](./research-adapters.md) — nightly prospect feed (Exa + RSS → task queue), quality rules, scheduler
- (next) research-adapters, security-watchdog, youtube-skill

## Site facts (lib/site.ts — Roman, 2026-10-12)
| Fact | Value | Used by |
|---|---|---|
| Support / contact email | `sfbconnectsupport@gmail.com` (`SUPPORT_EMAIL`) | every displayed address, legal pages, vCard, Resend `replyTo` default (From stays `hello@sfbconnect.com`, the verified domain) |
| Legal entity / address / law | Six Figure Blueprints LLC (FL) · 1200 Brickell Ave, Miami, FL · Florida | `lib/legal/documents.ts` resolutions |
| Hours (booking slots = callback window) | `SCHEDULE_ET`: Mon–Fri 8:00–8:45 AM & 11:30 AM–6:45 PM · Sat–Sun 8:00 AM–3:00 PM ET · callback owner Roman | `buildSlots`, `callbackWindowOpen`, `callbackPromise`, `callbackHint`, modal `HOURS_LABEL` |
| Homepage walkthrough video | `site_settings.walkthrough_video_url` (+ poster), set at `/team/settings` → Homepage video; files in public bucket `site-media` | `components/home/AgentSection.tsx` — real `<video>` when set, honest "coming" state when not; `/api/team/site-settings` owner-only |
