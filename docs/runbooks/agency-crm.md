# Runbook — Agency CRM (/app/leads, /app/pipeline, /app/followups)
- Tables (applied 2026-10-26, additive): agy_pipeline_stages, agy_leads, agy_lead_activities, agy_followups; agy_seed_stages(agency) (service_role only). Default pipeline: New Lead → Contacted → Qualified → Demo Sent → Demo Viewed → Meeting Booked → Proposal Sent → Won / Lost; stages are per-agency rows (editable by owner/admin through RLS; a UI for it is not built yet).
- Roles (RLS): owner/admin/sales_manager see and edit all leads; sales_rep sees and edits only leads they own and can only create leads owned by themselves; fulfillment/support read all. Leads are archived, never deleted; history is append-only. Duplicate emails per agency are refused.
- Actions: POST /api/app/leads {create, stage, next, note, followup, done, update, attach_demo, archive}. Agency comes from the membership; every write uses the session client.
- Automation: when a published demo attached to a lead is opened, that lead moves to Demo Viewed (only from New Lead/Contacted/Qualified/Demo Sent) and the history records it.
- Isolation verified 2026-10-26 in a rolled-back transaction: reps see only their leads; cross-agency inserts, foreign stages, unowned rep leads, duplicate emails, deletes and history edits are all refused.
- Not built yet: lead CSV import, stage editor, calls/meetings, assignment UI, commission tracking.
