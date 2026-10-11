import type { ToolDef } from "../tools";
import { AgentAuthError } from "../auth";
import { getClient } from "../store";
import * as Q from "./queue";

// Task-queue tools exposed over MCP/REST. The agent's identity comes from
// its OAuth client (Muse -> atlas, Hyperagent -> hyperagent), never from
// arguments, so an agent cannot act as another agent.
const obj = (props: Record<string, unknown>, required: string[] = []) => ({ type: "object", properties: props, required, additionalProperties: false });
const str = (d: string, extra: Record<string, unknown> = {}) => ({ type: "string", description: d, ...extra });
const HANDLES = ["atlas", "hyperagent", "roman"];

async function me(clientId: string): Promise<Q.AgentHandle> {
  const c = await getClient(clientId);
  return Q.agentHandleForClient(c?.client_name ?? clientId);
}
/** The acting handle. No owner override from the authorizing account: an agent is held to the assignee rule regardless of who authorized it. */
async function actor(ctx: Parameters<ToolDef["run"]>[0]): Promise<Q.TaskActor> { return { handle: await me(ctx.clientId) }; }
function wrap<T>(fn: () => Promise<T>): Promise<T> {
  return fn().catch((e) => { if (e instanceof Q.TaskError) throw new AgentAuthError(e.status, e.code, e.message); throw e; });
}
const s = (v: unknown) => (typeof v === "string" ? v : "");

export const TASK_TOOLS: ToolDef[] = [
  {
    name: "list_tasks", scope: "sfb:tasks", readOnly: true,
    description: "List agent tasks. HyperAgent's runner loop: list_tasks({status:'open', owner_agent:'hyperagent'}). Atlas's review loop: list_tasks({status:'in_review', reviewer_agent:'atlas'}). Defaults to the 50 newest across all statuses.",
    inputSchema: obj({ status: str("open | claimed | in_progress | in_review | done | rejected | blocked | canceled | closed (or comma-separated)"), owner_agent: str("Filter by who should do the work", { enum: HANDLES }), created_by: str("Filter by creator", { enum: HANDLES }), reviewer_agent: str("Filter by reviewer", { enum: HANDLES }), limit: { type: "integer", minimum: 1, maximum: 200 } }),
    outputSchema: obj({ me: str(""), tasks: { type: "array" } }),
    run: (ctx, a) => wrap(async () => ({ me: await me(ctx.clientId), tasks: await Q.listTasks({ status: s(a.status) ? (s(a.status).split(",").map((x) => x.trim()) as Q.TaskStatus[]) : undefined, owner_agent: s(a.owner_agent) as Q.AgentHandle || undefined, created_by: s(a.created_by) as Q.AgentHandle || undefined, reviewer_agent: s(a.reviewer_agent) as Q.AgentHandle || undefined, limit: typeof a.limit === "number" ? a.limit : undefined }) })),
  },
  {
    name: "get_task", scope: "sfb:tasks", readOnly: true,
    description: "One task with its full message thread.",
    inputSchema: obj({ task_id: str("agent_tasks.id") }, ["task_id"]),
    outputSchema: obj({ task: obj({}), messages: { type: "array" } }),
    run: (_ctx, a) => wrap(async () => ({ task: await Q.getTask(s(a.task_id)), messages: await Q.listMessages(s(a.task_id)) })),
  },
  {
    name: "create_task", scope: "sfb:tasks", readOnly: false,
    description: "Assign work to an agent (owner_agent defaults to atlas when omitted — unassigned work routes to Atlas). Write the context as a brief: what, why, acceptance criteria, links. requires_review defaults to true -- any task touching production data or customer surfaces MUST keep it true; the reviewer defaults to atlas (or hyperagent when atlas is the worker).",
    inputSchema: obj({ title: str("Short imperative title"), owner_agent: str("Who does the work; defaults to atlas", { enum: HANDLES }), context: str("The brief"), priority: str("low | normal | high | urgent", { enum: ["low", "normal", "high", "urgent"] }), due: str("ISO 8601 datetime, optional"), requires_review: { type: "boolean", description: "Default true" }, reviewer_agent: str("Optional override; cannot be the worker", { enum: HANDLES }) }, ["title"]),
    outputSchema: obj({ task: obj({}) }),
    run: (ctx, a) => wrap(async () => ({ task: await Q.createTask(await me(ctx.clientId), { title: s(a.title), owner_agent: (s(a.owner_agent) as Q.AgentHandle) || null, context: s(a.context) || undefined, priority: (s(a.priority) || "normal") as Q.TaskPriority, due: s(a.due) || null, requires_review: typeof a.requires_review === "boolean" ? a.requires_review : true, reviewer_agent: (s(a.reviewer_agent) as Q.AgentHandle) || null }) })),
  },
  {
    name: "claim_task", scope: "sfb:tasks", readOnly: false,
    description: "Claim an open task you own (atomic; a task can only be claimed once). Then do the work and post_result.",
    inputSchema: obj({ task_id: str("agent_tasks.id") }, ["task_id"]),
    outputSchema: obj({ task: obj({}) }),
    run: (ctx, a) => wrap(async () => ({ task: await Q.claimTask(await me(ctx.clientId), s(a.task_id)) })),
  },
  {
    name: "start_task", scope: "sfb:tasks", readOnly: false,
    description: "Mark a claimed task in_progress (optional signal for the board).",
    inputSchema: obj({ task_id: str("agent_tasks.id") }, ["task_id"]),
    outputSchema: obj({ task: obj({}) }),
    run: (ctx, a) => wrap(async () => ({ task: await Q.startTask(await me(ctx.clientId), s(a.task_id)) })),
  },
  {
    name: "post_result", scope: "sfb:tasks", readOnly: false,
    description: "Post what you did with evidence links (commits, URLs, screenshots). A task that requires review moves to in_review and waits for the reviewer; otherwise it is done. Set blocked:true to report a blocker instead.",
    inputSchema: obj({ task_id: str("agent_tasks.id"), result: str("Plain-English result or blocker"), evidence_links: { type: "array", items: { type: "string" } }, blocked: { type: "boolean" } }, ["task_id", "result"]),
    outputSchema: obj({ task: obj({}) }),
    run: (ctx, a) => wrap(async () => ({ task: await Q.postResult(await me(ctx.clientId), s(a.task_id), { result: s(a.result), evidence_links: Array.isArray(a.evidence_links) ? (a.evidence_links as unknown[]).map(String) : [], blocked: a.blocked === true }) })),
  },
  {
    name: "review_task", scope: "sfb:tasks", readOnly: false,
    description: "Reviewer only: approve (-> done), request changes (-> back to in_progress), or reject an in_review task. The worker can never approve its own task (database-enforced).",
    inputSchema: obj({ task_id: str("agent_tasks.id"), verdict: str("approved | changes_requested | rejected", { enum: ["approved", "changes_requested", "rejected"] }), note: str("Why / what to change") }, ["task_id", "verdict"]),
    outputSchema: obj({ task: obj({}) }),
    run: (ctx, a) => wrap(async () => ({ task: await Q.reviewTask(await me(ctx.clientId), s(a.task_id), s(a.verdict) as "approved" | "changes_requested" | "rejected", s(a.note) || undefined) })),
  },
  {
    name: "cancel_task", scope: "sfb:tasks", readOnly: false,
    description: "Cancel a task you created.",
    inputSchema: obj({ task_id: str("agent_tasks.id"), reason: str("Optional") }, ["task_id"]),
    outputSchema: obj({ task: obj({}) }),
    run: (ctx, a) => wrap(async () => ({ task: await Q.cancelTask(await me(ctx.clientId), s(a.task_id), s(a.reason) || undefined) })),
  },
  {
    name: "close_task", scope: "sfb:tasks", readOnly: false,
    description: "Close a task administratively (status closed — distinct from done, which only review_task can set). Allowed for the task's assignee (owner_agent / claimed_by) or an unassigned task; Roman (team API) may close anything. Records closed_by/closed_at and posts the close (with your reason) to the task thread.",
    inputSchema: obj({ task_id: str("agent_tasks.id"), reason: str("Why it is being closed (goes on the thread)") }, ["task_id"]),
    outputSchema: obj({ task: obj({}) }),
    run: (ctx, a) => wrap(async () => ({ task: await Q.closeTask(await actor(ctx), s(a.task_id), s(a.reason) || undefined) })),
  },
  {
    name: "update_task", scope: "sfb:tasks", readOnly: false,
    description: "Partial edit of a task: only the fields you pass change. Same permission rule as close_task. status may be open | in_progress | blocked | canceled | closed (done needs review_task). Reassigning owner_agent re-opens a claimed task for the new owner and fixes a reviewer that would equal the worker. Every change is posted to the task thread. Returns the updated task.",
    inputSchema: obj({ task_id: str("agent_tasks.id"), title: str("New title"), context: str("New brief (replaces)"), priority: str("low | normal | high | urgent", { enum: ["low", "normal", "high", "urgent"] }), due: str("ISO 8601 datetime, or empty string to clear"), owner_agent: str("Reassign to", { enum: HANDLES }), status: str("open | in_progress | blocked | canceled | closed", { enum: ["open", "in_progress", "blocked", "canceled", "closed"] }) }, ["task_id"]),
    outputSchema: obj({ task: obj({}) }),
    run: (ctx, a) => wrap(async () => ({ task: await Q.updateTask(await actor(ctx), s(a.task_id), {
      ...(typeof a.title === "string" ? { title: a.title } : {}), ...(typeof a.context === "string" ? { context: a.context } : {}), ...(typeof a.priority === "string" ? { priority: a.priority as Q.TaskPriority } : {}),
      ...(typeof a.due === "string" ? { due: a.due.trim() === "" ? null : a.due } : {}), ...(typeof a.owner_agent === "string" ? { owner_agent: a.owner_agent as Q.AgentHandle } : {}), ...(typeof a.status === "string" ? { status: a.status as Q.TaskStatus } : {}),
    }) })),
  },
  {
    name: "send_message", scope: "sfb:tasks", readOnly: false,
    description: "Post a message on a task's thread, optionally addressed to a specific agent. Use for questions, hand-offs and status notes instead of relaying through Roman.",
    inputSchema: obj({ task_id: str("agent_tasks.id"), body: str("Message"), to_agent: str("Optional recipient", { enum: HANDLES }) }, ["task_id", "body"]),
    outputSchema: obj({ message: obj({}) }),
    run: (ctx, a) => wrap(async () => ({ message: await Q.sendMessage(await me(ctx.clientId), s(a.task_id), s(a.body), (s(a.to_agent) as Q.AgentHandle) || null) })),
  },
  {
    name: "inbox", scope: "sfb:tasks", readOnly: true,
    description: "Messages addressed to you (or broadcast) in the last 7 days, newest first. Poll this with list_tasks.",
    inputSchema: obj({ days: { type: "integer", minimum: 1, maximum: 30 } }),
    outputSchema: obj({ me: str(""), messages: { type: "array" } }),
    run: (ctx, a) => wrap(async () => { const h = await me(ctx.clientId); return { me: h, messages: await Q.inbox(h, typeof a.days === "number" ? a.days : 7) }; }),
  },
];
