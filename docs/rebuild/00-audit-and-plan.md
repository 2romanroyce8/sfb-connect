# Agency platform rebuild — Phase 0 audit + plan (2026-10-26, branch agency-platform)
Direction (Roman, 2026-10-26): the rebuild is the only priority. The /team dashboard keeps its UI (buttons, components, update functions); only colors and tabs change. Nothing ships to production without approval: all work is on this branch; DB changes are migration FILES until approved.

## 1. Existing-site audit (read from code and the live database, read-only)
- Stack: Next.js 14 (App Router, TS, Tailwind), Supabase (Postgres + Auth + RLS), Stripe, Vercel (auto-deploy main). 165 public tables.
- Route groups: public (/, /pricing, /start, /login, /privacy, /terms), customer portal /dashboard (+ /dashboard/chat), internal Sales OS /team (31 pages), /admin (users.role='admin'), agent layer /api/v1/agent/*.
- Users: 4 (2 owners, 2 sales reps). crm_leads: 340. businesses: 1 (house account "SFB Connect", plan solo). payments 0, annual memberships 0, revenue_events 0, agent_plan_orders 0.
- Consequence: no paying customer or subscription exists, so replacing the public site cannot break customer access today. The "$200/year AI Presence" offer has 0 subscribers; its code (pricing/analyzer) is kept and later registered as a fulfillment-catalog service, not deleted.
- Reusable as-is: team shell + sidebar, MultiSelect/BulkBar, theme tokens (light/dark), assistant (ChatHome), agent OAuth/MCP layer, credit/usage ledger, outbound engine, research engine, Stripe checkout.

## 2. Reference status
luminasales.io has NOT been inspected yet (Phase 1 step, via browser). Authenticated areas can't be observed and will be built from the written requirements, labeled as such.

## 3. Architecture decisions
- Tenancy: new `agencies` + `agency_members(role)`; every agency-owned table carries agency_id; RLS through `agy_is_member(agency_id, roles[])` (security definer). Agency tables are prefixed `agy_` to avoid collisions with existing leads/projects/payments.
- Isolation from /team: agency tables never reference crm_* or outbound_*; the /team Sales OS stays RR Empire internal. Agencies cannot read any SFB prospect data (no FK, no policy, no grant).
- Routes: agency workspace `/app/*` (new layout reusing the team shell), client portal `/portal/*`, public demos `/d/<slug>` (and verified custom hostnames), operator `/admin`.
- Custom domains: `agency_domains.hostname` is UNIQUE and serves content only after DNS verification (`verified_at`); inserts cannot pre-set it.
- Public demo writes (sessions/events) go through server routes with service_role; anon has no table access.
- Billing: platform subscription via existing Stripe; agency-to-client billing needs Stripe Connect (decision pending, not assumed).
- Voice/chat demos: server-side provider keys only; sandboxed, session-capped; simulations labeled as simulations.

## 4. Migration plan (additive)
M1 `20261026_agency_core.sql` (this branch, validated in a rolled-back transaction): agencies, agency_members, agency_branding, agency_domains, agy_industry_packs, agy_demo_projects, agy_demo_sessions, agy_demo_events, agy_clients — RLS + explicit grants per the Oct-30 rule. Later: M2 CRM/pipelines/prospects, M3 clients/onboarding/fulfillment, M4 agents/automations/comms, M5 billing/usage. Applied to production only after approval.

## 5. Phases and status
0 Audit — done (this doc). 1 Public site — next (needs reference inspection + approval of copy/pricing; no price is invented). 2 Workspace — M1 written; app code next. 3 Demo builder. 4 CRM. 5 Portal. 6 Fulfillment. 7 Automations/agents. 8 Billing/usage. 9 Hardening. 10 Staged deploy with your approval.
## 6. Testing + rollback
Tenant-isolation tests (two agencies, cross-reads must fail), role tests, browser journeys on the branch preview. Rollback = do not merge the branch; migrations are additive and droppable.
## 7. Open questions for Roman
1) Platform pricing for agencies (nothing invented; leave blank until you set it). 2) Stripe Connect vs. you collecting and paying out. 3) Voice provider (ElevenLabs key available?). 4) May I add the preview-URL check (Vercel token returned 403 earlier)?
