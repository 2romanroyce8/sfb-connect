# Runbook — Agent Task Queue

**Purpose:** Atlas (Muse) and HyperAgent hand work to each other without Roman relaying. Review of anything touching production or customers is enforced by the database, not by convention.

## Where things live
- Tables: `public.agent_tasks`, `public.agent_messages` (migration `supabase/migrations/20261009_agent_task_queue.sql`).
- Enforcement: trigger `agent_tasks_guard` — a task with `requires_review=true` can only become `done` with `review_verdict='approved'` and `reviewed_by` ≠ the worker. No code path can bypass this.
- Library: `lib/agent/tasks/queue.ts`. Tools: `lib/agent/tasks/tools.ts` (registered into the agent connector's tool registry).
- Agent identity is derived from the OAuth client (`Muse` → `atlas`, `Hyperagent` → `hyperagent`); arguments can never impersonate another agent. Roman acts as `roman` through the team API.
- Board: `/team/tasks` (all team members read; owner creates, reviews, cancels, messages). API: `app/api/team/tasks/route.ts`.
- Scope: `sfb:tasks` (in the default grant; already granted to both live authorizations).

## Tools (MCP `tools/call` or REST `POST /api/v1/agent/tools/<name>`)
| Tool | Who | Effect |
|---|---|---|
| `list_tasks {status?, owner_agent?, created_by?, reviewer_agent?, limit?}` | any | newest first, urgent first |
| `get_task {task_id}` | any | task + thread |
| `create_task {title, owner_agent, context?, priority?, due?, requires_review?=true, reviewer_agent?}` | any | reviewer defaults to atlas (hyperagent if atlas is the worker) |
| `claim_task {task_id}` | owner of the task | atomic; open → claimed |
| `start_task {task_id}` | claimer | claimed → in_progress |
| `post_result {task_id, result, evidence_links?, blocked?}` | worker | → in_review (if requires_review) else done; blocked → blocked |
| `review_task {task_id, verdict, note?}` | named reviewer or roman | approved → done · changes_requested → in_progress · rejected → rejected |
| `cancel_task {task_id, reason?}` | creator or roman | → canceled |
| `send_message {task_id, body, to_agent?}` / `inbox {days?}` | any | thread messages |

## Runner contract
- **HyperAgent loop:** `list_tasks({status:"open", owner_agent:"hyperagent"})` → `claim_task` → work → `post_result` with evidence (commit SHAs, URLs). Then `list_tasks({status:"in_review", reviewer_agent:"hyperagent"})` to review Atlas's work.
- **Atlas loop:** create tasks with a real brief; `list_tasks({status:"in_review", reviewer_agent:"atlas"})` → `review_task`. Check `inbox` for questions.
- Status flow: `open → claimed → in_progress → in_review → done | rejected`; `blocked` and `canceled` are terminal until reopened by a new task.

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
