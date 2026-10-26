# Runbook — Agency workspace (/app), branch agency-platform
- Tables (applied 2026-10-26, additive): agencies, agency_members, agency_branding, agency_domains, agy_industry_packs, agy_demo_projects, agy_demo_sessions, agy_demo_events, agy_clients; helper agy_is_member(). RLS on, explicit grants, anon has none. Platform industry packs: 17 seeded (agency_id null).
- Tenant isolation verified 2026-10-26 in a rolled-back transaction: a member sees only their agency; foreign-agency writes, self-joining another agency, pre-verified domains and anon reads are all refused (42501).
- Code: /app (workspace shell reusing the team sidebar style), /app/start (create agency), /app/demos (create/publish), /api/app/agency, /api/app/demos. The agency always comes from the signed-in membership, never the request body; writes use the session client so RLS decides.
- Not built yet (each ships with its tab): public demo pages /d/<slug>, voice/chat/audit demos, CRM, clients/portal, fulfillment, automations, billing (Stripe Connect), usage.
- Rollback: don't merge the branch; to drop data: drop table agy_*, agency_* cascade (no other table references them).
