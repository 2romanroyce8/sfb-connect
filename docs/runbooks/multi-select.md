# Runbook — iPhone-style multi-select (2026-10-19)

Shared kit `components/ui/MultiSelect.tsx` (no dependencies) + pure rules `lib/ui/selection.ts` (tests `tests/lib/selection.test.ts`).
**Select** (header) → circles appear on the left; tapping a circle toggles, tapping the row still opens it. **Select All** = everything currently visible (tap again to clear). Bottom bar (fixed, safe-area aware, 44px buttons) shows the bulk actions. Destructive/big actions ask "Delete 14 emails?" first; afterwards a toast ("14 emails deleted") and selection mode ends. Selection survives filtering/sorting, but actions only run on ids that are selected **and** visible.

| List | Actions | Server |
|---|---|---|
| Outbound → Approval queue | Approve All (10 per request; roofing preset is held for the send window), Delete | `/api/team/outbound` `bulk_approve`, `bulk_delete_messages` (ids re-checked against the business) |
| Outbound → Activity messages | Delete | `bulk_delete_messages` |
| Outbound → Prospects | Add to campaign (drafts the campaign variant's template → approval queue, counts in Campaigns), Delete | `bulk_add_to_campaign`, `bulk_delete_prospects` |
| Leads | Change stage (not Won — needs the plan), Assign (owner), **Archive** | `/api/team/leads/bulk` (session client → RLS: reps only touch their own leads) |
| Give HyperAgent (Queue view only) | Mark done, Delete | `/api/team/prompts` `bulk_done`, `bulk_delete` (sent prompts are append-only) |
| Board Room ideas / killed archive | Change status (draft/ready/tested), Delete | `/api/team/board-room` `bulk_status`, `bulk_delete` |
| Campaigns list | Pause, Resume, Delete | `/api/team/campaigns` `bulk_pause`, `bulk_resume`, `bulk_delete` |
| Agent Tasks (owner) | Mark done (= close), Assign agent, Delete | `/api/team/tasks` `bulk_close`, `bulk_assign`, `bulk_delete` |

Leads use **Archive**, not hard delete: deleting a lead would also wipe its calls, notes, follow-ups and revenue history. Archived leads stay recoverable under Show Archived.
