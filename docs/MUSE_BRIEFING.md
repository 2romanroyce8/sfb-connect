# SFB Connect — Full Briefing for Muse

*Prepared by Hyperagent (Claude) for Muse, 2026-10-07. You and I are teammates on this product. This is everything I know, in the order you need it: what SFB Connect is, where it started, how it got here, exactly where it is right now, and where it is going. Read it all before touching anything.*

---

## 0. Your access (two doors, different powers)

| Door | Identity | Power | Use it for |
|---|---|---|---|
| **MCP connector** `https://www.sfbconnect.com/api/v1/agent/mcp` | OAuth client `sfbc_XrhJ-4WxHEPfSryY` ("Muse"), authorized by Roman | **Read-only**, acts as Roman under his RLS | Answering questions, pulling data, opening a read-only dashboard view |
| **Team login** `https://www.sfbconnect.com/team/login` | `muse@sfbconnect.com` (Roman gives you the password out of band) | **Owner** — same rights as Roman: full CRM, research, team management, Settings → Danger Zone | Doing work in the product as a teammate |

Hard limit on the owner login: **Roman's account (`2romanroyce8@gmail.com`) is the primary owner and is untouchable.** Database triggers refuse any delete, demotion, deactivation, ban, email change or ownership reassignment of that account — from the UI, the API, or the service role. You will get a 403 or a database error if you try. Don't try.

Your owner login is `leaderboard_eligible = false` so you never appear in staff rankings.

---

## 1. What SFB Connect is

SFB Connect is a two-sided product owned by **Roman Royce**:

1. **Public site + customer product (sfbconnect.com)** — "Be the business AI finds." Small businesses pay for **AI Presence**: monitoring and improving how AI systems (ChatGPT, Perplexity, Gemini, etc.) describe and recommend them. Pricing: Revenue Presence $19.99 (introductory) / Revenue Growth $197 (Most Popular) / Managed $269. Customer portal at `/dashboard` (AI Presence scores, progress, actions/credits, competitors, reports); real Stripe billing, add-ons and action credits; admin at `/admin`. Also sells websites and "solutions" (automation, AI receptionist, marketing, paid ads) with a public portfolio.
2. **SFB Sales OS (`/team/*`)** — the internal CRM/sales command center the team uses to find, research, call and close those small businesses. This is where almost all recent work has gone and where you will work.

Team today: Roman Royce (owner, founder), Braylen Garrett (sales rep), Logan Wells (sales rep), Muse (owner, you). Ashton Swann was offboarded 2026-09-15 and fully removed.

---

## 2. Where we started → where we progressed (timeline)

**Early Sept 2026 — marketing site to product.** The site was narrowed to AI Presence only (discontinued-service pages removed Sept 8). Pricing locked, ROI calculator, Book-a-Demo form, premium dark Apple-restraint design system (pure blacks `#000/#080808/#0D0D0D/#121212`, borders `rgba(255,255,255,0.08)`, success `#30D158`, warning `#FFD60A`, danger `#FF453A`; **brown-tinted blacks are forbidden**). A real `business-lookup` Supabase Edge Function powered the homepage "analyze my business" with deterministic 0–100 scoring (identity / knowledge / authority / location / machine-readability, 20 pts each, no LLM invents facts).

**Sept 3–10 — Sales OS born.** Roman delivered a very large blueprint (10 modules, 29 tables, 14 pipeline stages NEW→WON/LOST/DISQUALIFIED, 8-pass research, offer engine, call workspace with 11 outcomes, Google Calendar + Meet booking). Built incrementally: auth + roles (owner / sales_rep, RLS-enforced), leads, pipeline, research queue, call workspace, follow-ups, meetings, notes, calendar (Google OAuth built — waiting on Roman's Google client credentials), docs, activity feed, clock-in, revenue analytics, leaderboard engine (event-based points ledger, Phase L part 1), Work Plan V2 schema (State × City × Niche territory matrix, 50 states seeded, 71 CA cities, 57 niches, CA-01 Roofing assignment), timezone-aware scheduling, demo requests landing in the pipeline.

**Sept 10–16 — research engine hardening (V2).** Discovery provider abstraction (Exa), Facebook seed-recovery instrumentation + regression suite, crawl-frontier dedupe fix (page-level keys, per-domain budget, priority scoring), social-profile identity corruption fix (reserved-route filter, platform-owner denylist), generic-platform-content poisoning fix.

**Sept 17–21 — customer side.** Add-ons, action credits, real Stripe billing; customer portal phases 2–9; AI Visibility Monitoring + Intelligence Engine V1 (recurring production scanning left **disabled** on purpose); security fixes (self-granted membership hole, RLS privilege escalation); production hardening.

**Oct 5 — Research Spec v1 + session fixes.** Entity reconciliation layer (`lib/research/reconcile.ts`): every field carries status CONFIRMED / UNCERTAIN / NOT_FOUND / CONFLICT with provenance; identity gate; duplicate prevention; `assertOk` write guard (no silent DB failures); AUTO/DEEP/QUICK research scope; "Business Readiness Audit" naming (it measures readiness to be found by AI, not current AI visibility). Fixed team sessions expiring (middleware now carries rotated refresh tokens on redirects) and added a real "Stay signed in" control. **Reopening reset:** Roman had all leads, pipeline, research, demo requests, work sessions, points and territory assignments wiped (after backup) for a fresh start.

**Oct 5–6 — entity model + source adapters.** Facebook *personal profiles* are a **source type**, not an identity verdict: Person + Business + Relationship entity model (owner / employee / associated / unknown), never block saving except on genuine identity collision. Instagram, then LinkedIn, X and TikTok added as native **source adapters** feeding the same engine (`lib/research/sources/adapters.ts`), with employer ≠ ownership rules.

**Oct 6 — seed-contamination incident (critical) fixed architecturally.** A Facebook seed for Supreme Air LLC (NJ) came back as "How YouTube Works"/phone.gd. Root cause: discovered pages were attached without being tied to the seed. Fix: **seed resolution → lock → entity matching → verification** (`lib/research/entityMatch.ts`): every discovered page gets MATCHED / PROBABLE / POSSIBLE / UNVERIFIED / CONFLICTING / REJECTED with reasons; only MATCHED/PROBABLE pages contribute contacts, locations, socials, category; platform chrome never propagates trust; same-name business in another state is rejected on phone/region contradiction; seed phones ranked top. Verified live: seed locked, phone +1 732-213-0373 confirmed, 5 sources, 0 conflicts. 148 → 162 unit tests.

**Oct 6 — agent access layer (how you got in).** Full OAuth 2.1 + PKCE authorization server inside SFB Connect, dynamic client registration, consent screen behind team login, opaque SHA-256-hashed tokens (1h access / 30d rotating refresh, reuse → whole authorization revoked), delegated Supabase session per authorization (agent never sees the user's password, cookies or Supabase tokens), MCP Streamable HTTP endpoint + REST twins, 13 read-only semantic tools, delegated read-only browser sessions (middleware re-checks every request, refuses every non-GET), Settings → Connected Agents with Revoke + audit log, rate limits. End-to-end tests A–D passed against production. Live bugs found and fixed along the way: issuer host, Vercel rewriting `127.0.0.1`→`localhost` in query values, malformed ids echoing upstream errors, unified revocation, login redirect dropping the query string (that was your "unknown client"), hosted completion page for loopback callbacks (your `localhost:8765`).

**Oct 6–7 — owner data control.** Settings → **Danger Zone** (owner only): browse/delete any record or whole category across 45 data types, **Reset workspace** (typed phrase `RESET SFB CONNECT TEAM`, backup snapshot before wipe), every deletion snapshotted to `crm_data_deletion_log`. Then your login + primary-owner protection (this document's section 0).

---

## 3. Where we are right now (2026-10-07)

**Production:** `https://www.sfbconnect.com` (always use **www**; the apex redirects). Vercel auto-deploys `main` of GitHub `2romanroyce8/sfb-connect`. Supabase project `jisyhitqusdzfdscvbtb` ("SFBv2"), ~100+ public tables, ~100 commits since Sept 8, 162 passing unit tests (`npm test`).

**Data state (post-reopening):** 0 leads, 0 pipeline, 21 research results (all Supreme Air LLC test runs — safe to delete), 4 Work Plan markets (CA-01 Roofing), 7 document folders, 0 customer businesses, 0 demo requests. Connected agents: Hyperagent (active), Muse (active), one stale "E2E Test Agent" (unused, pending cleanup).

**Sales OS routes:** `/team/dashboard` · `/team/leads` + `/team/leads/import` (paste a business/social URL → live SSE research) · `/team/pipeline` · `/team/research` (queue: pending / saved / discarded, Save as Lead / Research More / Discard) · `/team/research/[id]` (full profile, sources with entity-match verdicts) · `/team/audits` · `/team/calls` · `/team/follow-ups` · `/team/meetings` · `/team/calendar` · `/team/notes` · `/team/docs` · `/team/activity` · `/team/clock` · `/team/leaderboard` · `/team/charts` · `/team/performance` · `/team/work-plan` · `/team/scripts` · `/team/portfolio` · `/team/team` (owner) · `/team/integrations` (owner) · `/team/settings` (Profile, Workspace, Timezone, Security, **Connected Agents**, **Danger Zone**).

**Research engine (the crown jewel) — how to think about it:**
- Seed URL (website, Facebook page/profile, Instagram, LinkedIn, X, TikTok) → `classifySeedUrlType` / adapter → fetch (mbasic fallback for Facebook; login walls detected; generic platform shells never contribute) → seed entity resolved and **locked** → discovery (links, public index via Exa, website sub-pages under per-domain budget) → every page entity-matched against the seed → reconciliation into a `ResearchProfile` (identity, person/business/relationship, contacts, locations, socials, category/services, conflicts, limitations, metrics) → persisted to `crm_research_results` + `crm_research_sources` + `crm_research_entities` + relationships.
- **No-hallucination rule is absolute.** Missing → NOT_FOUND, contradictory → CONFLICT, incomplete → UNCERTAIN. Never invent phone/email/owner/address/reviews/services.
- Key files: `lib/research/LeadProfileBuilder.ts` (orchestrator), `reconcile.ts`, `entityMatch.ts`, `normalize.ts` (reserved routes, infra hosts), `sources/adapters.ts`, `sources/publicIndex.ts`, `persistProfile.ts`, `duplicates.ts`, `fetchSource.ts`, `GenericPlatformContent.ts`, `CrawlPriority.ts`; tests in `tests/research/*`.

**Security model you must respect:**
- Supabase RLS is the law: owners see everything, reps see their assigned leads / own records. Service role is used server-side only after an explicit owner check.
- Agent tokens are opaque and hashed; the audit log never stores tokens, cookies or secrets.
- Agent browser sessions are read-only by middleware; your *owner login* is not read-only — you are a full teammate there.
- `/team` is never public.

---

## 4. Where we are going (roadmap, in Roman's priority order)

**Master phase checklist (from Roman's mega-spec):**
- A Research/Lead separation, edit/archive/delete, Research V2 — **DONE**
- I Google OAuth + Calendar + Meet, J Booking automation — **built, blocked on Roman adding `GOOGLE_CLIENT_ID/SECRET`**
- E Unified Call Workspace (teleprompter, live business view, resizable panels) — PARTIAL
- H Advanced CRM Calendar (day/week/month, personal/work/team, visibility, mentions, ICS) — PARTIAL
- L Leaderboard — part 1 DONE (ledger, scoring, page); remaining: owner config UI, incentives/payouts, streaks/achievements, quotas, scheduled awards, Employee of Week/Month, anti-gaming job, dashboard widgets
- B Clock In / Personal vs Work mode · C Daily SOP engine + Owner SOP Builder · D Per-business Q&A + Call Readiness gate · F Required call-info panel, script branching, tone · G Live Objection Center · K Post-call AI summary + Next Action engine · M Global AI Assistant + ⌘K · N Notifications/real-time · O Mobile · P Full QA/security/RLS pass — **NOT STARTED**
- Quality-control addendum (duplicate protection, contact history before call, do-not-contact, manager review queue, disposition requirements, show-tracking → commission ledger, offer/script versioning, training mode, broadcasts, daily closeout, freshness indicators, lost reason codes, full funnel analytics, "Owner Reached" event) — NOT STARTED

**Work Plan V2 / Autonomous Scout:** schema + seed done; still to build: opportunity scoring (needs real discovery data — never fabricate a score), automatic city rotation, Work Plan UI ("Today's Market", START WORK queue), State Prioritization Agent, market-discovery orchestration, full CA place ingest (Census/CA Open Data, programmatic, never hand-typed).

**Agent layer next steps:** per-grant write scopes behind explicit confirmation (off by default); Muse should register an **https callback it hosts** so re-authorizations need no copy-paste; clean up test clients.

**Known external dependencies (Roman must supply):** Google OAuth client credentials; AI provider key for the Sales Assistant; SMS/email provider; `EXA_API_KEY` is configured for research discovery.

**Open flags not yet decided:** `public.audit_categories` RLS still disabled (old table); recurring AI visibility scanning disabled on purpose; 21 Supreme Air test research rows ready to delete.

---

## 5. How we work (team rules — these are Roman's, learned the hard way)

1. **No fake success.** Never say something works because an endpoint returned 200. Verify end to end with real data, in production, as the real user.
2. **No hallucinated facts in the product.** The research engine, audits and scripts only state what sources prove.
3. **Incremental, production-grade builds.** "Build module X only." No throwaway versions; shared architecture from day one; DB + RLS + API + UI + logging + error/empty states before calling anything complete.
4. **Disclose deviations.** If you skip or change something from the spec, say so explicitly.
5. **Resource safety.** Don't substitute resources, don't repurpose tables with data, don't delete without a backup path (Danger Zone snapshots everything), and never touch Roman's account.
6. **Design discipline.** Pure blacks, Apple restraint, no brown-tinted blacks, no decorative fakery (no fake dialers, no fake roles, no fake "connected" badges).
7. **Commit hygiene.** Small, explained commits on `main`; Vercel deploys automatically; migrations also committed under `supabase/migrations/`.
8. **Coordinate.** Hyperagent and Muse are both owners now. Before destructive or schema-changing work, check Settings → Connected Agents / the deletion log / recent commits so we don't collide.

---

## 6. Quick verification you can run right now

- MCP: `get_sfb_workspace` → `team_role: owner`, `access_level: read-only`. `get_sfb_team` → Roman, Braylen, Logan, Muse.
- Login: sign in at `/team/login` as `muse@sfbconnect.com` → dashboard; `/team/settings` shows Connected Agents and Danger Zone (you are an owner).
- Guardrail: `/team/team` → try to deactivate or demote Roman → refused with "The primary owner account cannot be modified by another account."

Welcome aboard.
