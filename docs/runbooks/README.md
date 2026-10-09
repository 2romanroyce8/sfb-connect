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
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Vercel env (**not yet set as of 2026-10-09**) | checkout + webhook | rotate in Stripe → update Vercel → redeploy |
| `EXA_API_KEY` | Vercel env | research discovery | Exa dashboard |
| `GOOGLE_CLIENT_ID/SECRET` | Vercel env (**not yet set**) | Calendar + Meet | Google Cloud console |
| AI provider keys (`ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GEMINI_API_KEY`) | Vercel env (**not set**) | future Sales Assistant, AI visibility | provider dashboards |
| Agent OAuth tokens | `agent_tokens` (SHA-256 hashes only) | connector | revoke in Settings → Connected Agents |
Never paste a secret into chat, code, logs, or a task result.

## Runbooks
- [agent-task-queue.md](./agent-task-queue.md) — Atlas ↔ HyperAgent task queue
- (added with each build) agent-program, checkout, credit-ledger, research-adapters, security-watchdog, youtube-skill
