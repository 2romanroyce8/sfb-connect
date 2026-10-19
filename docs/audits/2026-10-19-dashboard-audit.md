# Dashboard audit — 2026-10-19 (Rome: every part must help close deals)

Code audit of every /team section. Usage data was not available (no DB/analytics access), so "used during blitz week" is judged from purpose and recent work, and anything uncertain is flagged for Rome rather than deleted. Nothing was deleted; removals are from navigation and every page is still reachable by URL.

## Fixed (was broken)
- **Demo Done leads vanished from the Pipeline.** Marking a demo completed sets `meeting_completed`; the board had no column for it, the Leads list had no label, and the stage API refused it. One shared list now drives all of them: `lib/crm/stages.ts` (13 stages, same set as analytics). New column "Demo Done" between Meeting Booked and Proposal.
- **Leads list showed raw stage keys** (e.g. "meeting_booked") with a grey dot for 5 real stages; it carried labels for two stages nothing writes (qualified, proposal_sent).

## Removed from navigation
- **Lead Research** — duplicate of Leads → New Lead (same page), and it lit up together with Leads.
- **Give HyperAgent, Agent Tasks, Client Projects** — hidden from reps (owner-only now). Rome's tooling / post-sale delivery; no rep uses them to close.

## Optimized
- Sidebar regrouped by the selling day: Dashboard + Follow-Ups on top; Sell (Leads, Pipeline, Calls, Meetings, Calendar, Outbound Email); Research; Goals & Results; Workspace; Owner; Settings. Reps: 20 → 16 items. Leads no longer sits alone in a collapsible "Records" group (one less click).
- Leads list rows open with client-side navigation + hover prefetch instead of a full page reload.
- Clearer labels: Analytics → Revenue, Performance → Rep Performance, Clock → Timesheets, Projects → Client Projects, Outbound → Outbound Email.

## Kept (purpose in one line)
Dashboard (today at a glance) · Follow-Ups (who to call next) · Leads (every lead + tags) · Pipeline (where each deal stands) · Calls (dialing + outcomes) · Meetings (demos booked/attended) · Calendar (Google-synced schedule) · Outbound Email (approved roofing sequence tonight) · Research Queue / Business Audits (pre-call intel that feeds the pitch) · Work Plan (rep targets) · Leaderboard (blitz motivation) · Revenue (rep's own sales; company/Stripe owner-only) · Rep Performance (owner coaching) · Timesheets · Team · Integrations · Settings.

## Flagged for Rome (not changed)
1. **Agent Tasks** — /team/tasks *is* the agent board; awaiting Rome's 1/2/3 choice.
2. **Notes** and **Activity** — no clear deal role during blitz; Notes overlaps lead notes, Activity overlaps Dashboard. Candidates to hide.
3. **Meetings vs Calendar** — both list demos. Consolidate into Calendar?
4. **Revenue (Sales tab) vs Rep Performance** — overlapping rep metrics. Merge into one reporting page?
5. **Portfolio, Legal Drafts** — owner-only, not deal tools this week. Move under Settings?
6. **Orphan pages** — /team/docs and /team/scripts have no navigation link (scripts are opened per lead). Delete, or link?
7. **Research Queue + Business Audits** — keep if reps read audits before calls; otherwise fold Audits into the lead profile.
