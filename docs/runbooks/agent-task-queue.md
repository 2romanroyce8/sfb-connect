# Runbook — Agent Task Queue

**Purpose:** Atlas (Muse) and HyperAgent hand work to each other without Roman relaying. Review of anything touching production or customers is enforced by the database, not by convention.

## Where things live
- Tables: `public.agent_tasks`, `public.agent_messages` (migration `supabase/migrations/20261009_agent_task_queue.sql`).
- Enforcement: trigger `agent_tasks_guard` — a task with `requires_review=true` can only become `done` with `review_verdict='approved'` and `reviewed_by` ≠ the worker. No code path can bypass this.
- Library: `lib/agent/tasks/queue.ts`. Tools: `lib/agent/tasks/tools.ts` (registered into the agent connector's tool registry).
- Agent identity is derived from the OAuth client (`Muse` → `atlas`, `Hyperagent` → `hyperagent`); arguments can never impersonate another agent. Roman acts as `roman` through the team API.
- Board: `/team/tasks` (all team members read; owner creates, reviews, cancels, messages). API: `app/api/team/tasks/route.ts`.
- Scope: `sfb:tasks` (in the default grant). A client that requests an explicit scope list WITHOUT `sfb:tasks` does not get it — Muse's 2026-10-11 15:29 UTC grant did exactly that until it re-authorized at 20:34 UTC.
- Migrations: `20261009_agent_task_queue.sql`, `20261011_task_close_update.sql` (status `closed`, `closed_by`, `closed_at`).

## Tools (MCP `tools/call` or REST `POST /api/v1/agent/tools/<name>`)
| Tool | Who | Effect |
|---|---|---|
| `list_tasks {status?, owner_agent?, created_by?, reviewer_agent?, limit?, full?}` | any | newest first, urgent first; **summaries** — context/result cut to 400 chars with `context_truncated` / `result_truncated` flags (2026-10-11, after a client choked on a ~110 KB list); `full:true` returns whole bodies; `get_task` always has the full brief |
| `get_task {task_id}` | any | task + thread |
| `create_task {title, owner_agent, context?, priority?, due?, requires_review?=true, reviewer_agent?}` | any | reviewer defaults to atlas (hyperagent if atlas is the worker) |
| `claim_task {task_id}` | owner of the task | atomic; open → claimed |
| `start_task {task_id}` | claimer | claimed → in_progress |
| `post_result {task_id, result, evidence_links?, blocked?}` | worker | → in_review (if requires_review) else done; blocked → blocked |
| `review_task {task_id, verdict, note?}` | named reviewer or roman | approved → done · changes_requested → in_progress · rejected → rejected |
| `cancel_task {task_id, reason?}` | creator or roman | → canceled |
| `close_task {task_id, reason?}` | assignee (owner_agent / claimed_by) · unassigned task · roman | → `closed` (administrative; distinct from reviewed `done`); sets `closed_by`, `closed_at`; posts "Closed by …" to the thread |
| `update_task {task_id, title?, context?, priority?, due?, owner_agent?, status?}` | same rule as close_task | partial update, returns the task; `status` ∈ open · in_progress · blocked · canceled · closed (`done` only via review_task); reassigning re-opens a claimed task and fixes a reviewer equal to the new worker; every change posted to the thread |
| `send_message {task_id, body, to_agent?}` / `inbox {days?}` | any | thread messages |

## Runner contract
- **HyperAgent loop:** `list_tasks({status:"open", owner_agent:"hyperagent"})` → `claim_task` → work → `post_result` with evidence (commit SHAs, URLs). Then `list_tasks({status:"in_review", reviewer_agent:"hyperagent"})` to review Atlas's work.
- **Atlas loop:** create tasks with a real brief; `list_tasks({status:"in_review", reviewer_agent:"atlas"})` → `review_task`. Check `inbox` for questions.
- Status flow: `open → claimed → in_progress → in_review → done | rejected`; `blocked`, `canceled` and `closed` are terminal (`update_task {status:'open'}` reopens blocked/canceled; closed stays closed).
- **Default routing (2026-10-11):** `create_task` without `owner_agent` assigns to **atlas**. Rule from Roman (locked 2026-10-11 17:30 ET): Atlas may manage tasks assigned to `atlas` or unassigned tasks only; assigned work stays hands-off. `canManageTask` in `queue.ts` enforces it per agent handle — the only override is the `roman` handle (team API). The authorizing account's team role does NOT grant an override.
- **Notes** are not a separate entity: the brief is `agent_tasks.context` (edit with `update_task`), running notes are the task thread (`send_message` / `get_task.messages` / `inbox`). There are no `list_notes` / `create_note` tools by design.
- **tools/list** returns every tool whose scope the connection holds — nothing callable is hidden. If task tools are missing from the list, the authorization lacks `sfb:tasks`: re-authorize (it is in the default grant).

## Operating it
- Roman sees everything at `/team/tasks`, filterable by agent and status; the board refreshes every 30 s.
- A stuck `in_review` task: the owner can review it from the board (self-review by the worker is still refused by the database).
- Audit: every tool call is in `agent_audit_log` (Settings → Connected Agents → activity log).

## Failure modes
- `403 not_owner` on claim: the task is owned by the other agent — don't claim, message instead.
- `42501` from the database on `done`: someone tried to mark a reviewed task done without an approval — expected; use `review_task`.
- Scope missing (`insufficient_scope`): re-authorize the agent; `sfb:tasks` is in the default grant.

## Smoke test (after any change)
1. As hyperagent: `create_task` owned by atlas, requires_review true.
2. As atlas: `claim_task`, `post_result` → status `in_review`, reviewer `hyperagent`.
3. As atlas: `review_task approved` → must fail (self-review).
4. As hyperagent: `review_task approved` → `done`.
