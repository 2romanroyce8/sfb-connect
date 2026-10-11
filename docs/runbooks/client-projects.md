# Runbook — Client project graph (`/team/projects`)

Client → Task → Subtasks (dashed) + Client Notes + Assigned Roles, as a draggable node graph. Internal view shipped 2026-10-11; the client-dashboard mirror (own projects only, add/edit Client Notes, approve/reject tasks) lands after Phase 2's customer dashboard.

## Pieces
| Piece | Path |
|---|---|
| Tables | `client_projects` (positions jsonb), `client_project_tasks` (assignees uuid[], tech_stack text[], `internal_note` **internal-only**, `client_approval`), `client_project_subtasks`, `client_project_notes` (author_kind client/team), `client_project_roles` — migration `20261011_client_projects.sql`. Distinct from legacy `projects` (audit scans). |
| Types + pure layout | `lib/projects/graph.ts` — `layoutGraph` (deterministic; dragged positions win), `clientSafeGraph` (drops `internal_note`), `parseTechStack` |
| Store (service role) | `lib/projects/store.ts` — every write scoped by `project_id`; children re-checked to belong to it |
| API | `GET/POST /api/team/projects` — team members CRUD; `delete_project` owner-only. Actions: create_project, update_project, delete_project, set_positions {positions|reset}, add/update/delete_task, add/update/delete_subtask, add/update/delete_note, add/update/delete_role |
| UI | `components/team/ProjectsWorkspace.tsx` (switchers, drawer forms, mobile cards) + `components/team/ProjectGraph.tsx` (dependency-free canvas: pan, wheel zoom, drag nodes, SVG edges; `.sfb-glass` nodes on a dotted near-black canvas, lime accents) |
| Sidebar | Workspace → Projects |
| Tests | `tests/lib/projects.test.ts` |

## Rules
- Client space = any `businesses` row with a `plan_key` (trial or paid). Logo = `brand_logo_url` (initial chip when none — no placeholder logos). Onboarded = `businesses.created_at`.
- Real data only: no sample nodes; empty states say so. A task without subtasks/notes gets no empty node.
- Positions save ~600 ms after the last drag (`set_positions` merges); **Auto-layout** clears them (`reset:true`). Node ids: `client`, `task:<id>`, `subtasks:<taskId>`, `notes:<taskId|project>`, `role:<id>`.
- RLS: team members read all; the business owner can read their own project rows (prepared for the client mirror). The client API must use `clientSafeGraph` — tested — so `internal_note` never leaves.
- Tech stack is text chips (no invented vendor logos).

## Operate
- `select p.name, b.legal_name, (select count(*) from client_project_tasks t where t.project_id=p.id) tasks from client_projects p join businesses b on b.id=p.business_id order by p.created_at desc;`
- Mobile (<768px) renders stacked cards; drag/arrange is desktop-only.
