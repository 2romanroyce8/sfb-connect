import { emitIntegrationEvent } from "@/lib/integrations/events";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

// ============================================================
// AGENT TASK QUEUE
// Atlas (Muse) assigns; HyperAgent polls open tasks it owns, claims, works,
// posts results. A result that touches production data or customer
// surfaces (requires_review, the default) lands in 'in_review' and only a
// DIFFERENT agent's review_task(approved) can mark it done -- enforced by
// the agent_tasks_guard trigger, so no code path can skip it.
// ============================================================

export type AgentHandle = "atlas" | "hyperagent" | "roman";
export const AGENT_HANDLES: AgentHandle[] = ["atlas", "hyperagent", "roman"];
export type TaskStatus = "open" | "claimed" | "in_progress" | "in_review" | "done" | "rejected" | "blocked" | "canceled" | "closed";
export const TASK_STATUSES: TaskStatus[] = ["open", "claimed", "in_progress", "in_review", "done", "rejected", "blocked", "canceled", "closed"];
/** The default owner for work nobody was named for (owner directive 2026-10-11: unassigned work routes to Atlas). */
export const DEFAULT_OWNER_AGENT: AgentHandle = "atlas";
export type TaskPriority = "low" | "normal" | "high" | "urgent";

/** OAuth client display name -> agent handle. Muse's agent is called Atlas. */
export function agentHandleForClient(clientName: string): AgentHandle {
  const n = clientName.trim().toLowerCase();
  if (n === "muse" || n === "atlas") return "atlas";
  if (n === "hyperagent") return "hyperagent";
  return "hyperagent";
}
export function isAgentHandle(v: unknown): v is AgentHandle { return typeof v === "string" && (AGENT_HANDLES as string[]).includes(v); }

export type AgentTask = {
  id: string; title: string; owner_agent: AgentHandle; status: TaskStatus; priority: TaskPriority; due: string | null; context: string | null; result: string | null;
  evidence_links: string[]; requires_review: boolean; reviewer_agent: string | null; review_verdict: string | null; review_note: string | null; reviewed_by: string | null; reviewed_at: string | null;
  created_by: string; claimed_by: string | null; claimed_at: string | null; result_posted_at: string | null; closed_by: string | null; closed_at: string | null; created_at: string; updated_at: string;
};

/** Who is calling: the agent handle (from the OAuth client) plus whether the authorizing user is a team owner (from users.team_role, never from arguments). */
export type TaskActor = { handle: AgentHandle; isTeamOwner: boolean };

/** close_task / update_task permission rule: team owner, or the task's assignee (owner_agent / claimed_by), or an unassigned task. Pure, tested. */
export function canManageTask(actor: TaskActor, task: Pick<AgentTask, "owner_agent" | "claimed_by">): boolean {
  if (actor.isTeamOwner) return true;
  if (!task.owner_agent) return true;
  return task.owner_agent === actor.handle || task.claimed_by === actor.handle;
}
/** Statuses update_task may set directly. done needs review_task; claimed / in_review are set by claim_task / post_result. */
export const UPDATABLE_STATUSES: TaskStatus[] = ["open", "in_progress", "blocked", "canceled", "closed"];

export class TaskError extends Error { constructor(public status: number, public code: string, message: string) { super(message); } }
const db = (): SupabaseClient => createSupabaseServiceClient();
const COLS = "id, title, owner_agent, status, priority, due, context, result, evidence_links, requires_review, reviewer_agent, review_verdict, review_note, reviewed_by, reviewed_at, created_by, claimed_by, claimed_at, result_posted_at, closed_by, closed_at, created_at, updated_at";
const FINAL: TaskStatus[] = ["done", "canceled", "closed"];
const PRIORITIES: TaskPriority[] = ["low", "normal", "high", "urgent"];
const isoOrNull = (v: unknown): string | null | undefined => { if (v === null) return null; if (typeof v !== "string" || !v.trim()) return undefined; const d = new Date(v); if (Number.isNaN(d.getTime())) throw new TaskError(400, "invalid_due", "due must be an ISO 8601 datetime."); return d.toISOString(); };

export async function createTask(by: AgentHandle, input: { title: string; owner_agent?: AgentHandle | null; context?: string; priority?: TaskPriority; due?: string | null; requires_review?: boolean; reviewer_agent?: AgentHandle | null }): Promise<AgentTask> {
  const title = input.title.trim().slice(0, 200);
  if (title.length < 3) throw new TaskError(400, "invalid_title", "Title must be at least 3 characters.");
  // No assignee → Atlas (owner directive: unassigned work defaults to Atlas).
  const owner: AgentHandle = input.owner_agent ?? DEFAULT_OWNER_AGENT;
  if (!isAgentHandle(owner)) throw new TaskError(400, "invalid_owner", `owner_agent must be one of ${AGENT_HANDLES.join(", ")}.`);
  const requires_review = input.requires_review ?? true;
  // The reviewer defaults to Atlas; a task can never name its own worker as reviewer.
  const reviewer = requires_review ? (input.reviewer_agent && input.reviewer_agent !== owner ? input.reviewer_agent : owner === "atlas" ? "hyperagent" : "atlas") : null;
  const { data, error } = await db().from("agent_tasks").insert({ title, owner_agent: owner, context: input.context?.slice(0, 20000) ?? null, priority: input.priority ?? "normal", due: input.due ?? null, requires_review, reviewer_agent: reviewer, created_by: by }).select(COLS).single();
  if (error || !data) throw new TaskError(500, "create_failed", error?.message ?? "Could not create task.");
  emitIntegrationEvent("task.created", { task_id: (data as AgentTask).id, title: (data as AgentTask).title, owner_agent: (data as AgentTask).owner_agent, priority: (data as AgentTask).priority, created_by: by });
  return data as AgentTask;
}

export async function listTasks(filter: { status?: TaskStatus | TaskStatus[]; owner_agent?: AgentHandle; created_by?: AgentHandle; reviewer_agent?: AgentHandle; limit?: number }): Promise<AgentTask[]> {
  let q = db().from("agent_tasks").select(COLS).order("created_at", { ascending: false }).limit(Math.min(Math.max(filter.limit ?? 50, 1), 200));
  if (filter.status) q = Array.isArray(filter.status) ? q.in("status", filter.status) : q.eq("status", filter.status);
  if (filter.owner_agent) q = q.eq("owner_agent", filter.owner_agent);
  if (filter.created_by) q = q.eq("created_by", filter.created_by);
  if (filter.reviewer_agent) q = q.eq("reviewer_agent", filter.reviewer_agent);
  const { data, error } = await q;
  if (error) throw new TaskError(500, "list_failed", error.message);
  // Priority order within the newest-first list: urgent first.
  const rank: Record<TaskPriority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
  return ((data ?? []) as AgentTask[]).sort((a, b) => rank[a.priority] - rank[b.priority] || (a.due && b.due ? a.due.localeCompare(b.due) : a.due ? -1 : b.due ? 1 : 0));
}

export async function getTask(id: string): Promise<AgentTask> {
  const { data, error } = await db().from("agent_tasks").select(COLS).eq("id", id).maybeSingle();
  if (error) throw new TaskError(500, "get_failed", error.message);
  if (!data) throw new TaskError(404, "not_found", "No such task.");
  return data as AgentTask;
}

/** Atomic claim: only an open task owned by the caller can be claimed. */
export async function claimTask(by: AgentHandle, id: string): Promise<AgentTask> {
  const { data, error } = await db().from("agent_tasks").update({ status: "claimed", claimed_by: by, claimed_at: new Date().toISOString() }).eq("id", id).eq("status", "open").eq("owner_agent", by).select(COLS).maybeSingle();
  if (error) throw new TaskError(500, "claim_failed", error.message);
  if (!data) {
    const t = await getTask(id);
    if (t.owner_agent !== by) throw new TaskError(403, "not_owner", `This task is owned by ${t.owner_agent}, not ${by}.`);
    throw new TaskError(409, "not_open", `Task is ${t.status}, not open.`);
  }
  return data as AgentTask;
}

export async function startTask(by: AgentHandle, id: string): Promise<AgentTask> {
  const { data, error } = await db().from("agent_tasks").update({ status: "in_progress" }).eq("id", id).eq("claimed_by", by).in("status", ["claimed", "in_progress"]).select(COLS).maybeSingle();
  if (error) throw new TaskError(500, "start_failed", error.message);
  if (!data) throw new TaskError(409, "cannot_start", "Only the claiming agent can start a claimed task.");
  return data as AgentTask;
}

/** Post the result. Reviewed tasks go to in_review; unreviewed go straight to done. */
export async function postResult(by: AgentHandle, id: string, input: { result: string; evidence_links?: string[]; blocked?: boolean }): Promise<AgentTask> {
  const t = await getTask(id);
  if (t.claimed_by !== by && t.owner_agent !== by) throw new TaskError(403, "not_worker", "Only the agent working this task can post its result.");
  if (!["claimed", "in_progress", "open"].includes(t.status)) throw new TaskError(409, "wrong_state", `Task is ${t.status}.`);
  const result = input.result.trim();
  if (result.length < 5) throw new TaskError(400, "empty_result", "Result must say what was done (or why it is blocked).");
  const links = (input.evidence_links ?? []).filter((l) => /^https?:\/\//.test(l)).slice(0, 20);
  const status: TaskStatus = input.blocked ? "blocked" : t.requires_review ? "in_review" : "done";
  const { data, error } = await db().from("agent_tasks").update({ status, result: result.slice(0, 20000), evidence_links: links, result_posted_at: new Date().toISOString(), claimed_by: t.claimed_by ?? by }).eq("id", id).select(COLS).single();
  if (error || !data) throw new TaskError(500, "post_failed", error?.message ?? "Could not post result.");
  emitIntegrationEvent("task.result_posted", { task_id: id, status: (data as AgentTask).status, posted_by: by });
  return data as AgentTask;
}

/** Review. The database refuses approval by the worker; this also refuses review by anyone but the named reviewer (or Roman). */
export async function reviewTask(by: AgentHandle, id: string, verdict: "approved" | "changes_requested" | "rejected", note?: string): Promise<AgentTask> {
  const t = await getTask(id);
  if (t.status !== "in_review") throw new TaskError(409, "not_in_review", `Task is ${t.status}; only in_review tasks can be reviewed.`);
  if (by !== "roman" && t.reviewer_agent && by !== t.reviewer_agent) throw new TaskError(403, "not_reviewer", `This task's reviewer is ${t.reviewer_agent}.`);
  if (by === (t.claimed_by ?? t.owner_agent)) throw new TaskError(403, "self_review", "A task cannot be reviewed by the agent that did the work.");
  const status: TaskStatus = verdict === "approved" ? "done" : verdict === "rejected" ? "rejected" : "in_progress";
  const { data, error } = await db().from("agent_tasks").update({ status, review_verdict: verdict, review_note: note?.slice(0, 5000) ?? null, reviewed_by: by, reviewed_at: new Date().toISOString() }).eq("id", id).select(COLS).single();
  if (error || !data) throw new TaskError(error?.code === "42501" ? 403 : 500, "review_failed", error?.message ?? "Could not review.");
  emitIntegrationEvent("task.reviewed", { task_id: id, verdict, reviewed_by: by });
  return data as AgentTask;
}

export async function cancelTask(by: AgentHandle, id: string, reason?: string): Promise<AgentTask> {
  const t = await getTask(id);
  if (by !== "roman" && t.created_by !== by) throw new TaskError(403, "not_creator", "Only the creator (or Roman) can cancel a task.");
  if (["done", "canceled"].includes(t.status)) throw new TaskError(409, "final", `Task is already ${t.status}.`);
  const { data, error } = await db().from("agent_tasks").update({ status: "canceled", review_note: reason ?? t.review_note }).eq("id", id).select(COLS).single();
  if (error || !data) throw new TaskError(500, "cancel_failed", error?.message ?? "Could not cancel.");
  return data as AgentTask;
}

/** Administrative close (status 'closed', distinct from reviewed 'done'). Records closed_by/closed_at and posts the close to the task thread. */
export async function closeTask(actor: TaskActor, id: string, reason?: string): Promise<AgentTask> {
  const t = await getTask(id);
  if (!canManageTask(actor, t)) throw new TaskError(403, "not_allowed", `Task ${id} is assigned to ${t.claimed_by ?? t.owner_agent}; only that agent or a team owner can close it.`);
  if (FINAL.includes(t.status)) throw new TaskError(409, "final", `Task is already ${t.status}.`);
  const now = new Date().toISOString();
  const { data, error } = await db().from("agent_tasks").update({ status: "closed", closed_by: actor.handle, closed_at: now }).eq("id", id).not("status", "in", `(${FINAL.join(",")})`).select(COLS).maybeSingle();
  if (error) throw new TaskError(500, "close_failed", error.message);
  if (!data) throw new TaskError(409, "final", "Task was closed by someone else first.");
  await db().from("agent_messages").insert({ task_id: id, from_agent: actor.handle, to_agent: null, body: `Closed by ${actor.handle}${reason?.trim() ? `: ${reason.trim().slice(0, 2000)}` : ""} (was ${t.status}).` });
  emitIntegrationEvent("task.closed", { task_id: id, closed_by: actor.handle, previous_status: t.status });
  return data as AgentTask;
}

export type TaskPatch = { title?: string; context?: string | null; priority?: TaskPriority; due?: string | null; owner_agent?: AgentHandle; status?: TaskStatus };

/** Partial update: only supplied fields change. Reassigning fixes a reviewer that would equal the new worker; status is limited to UPDATABLE_STATUSES (done still needs review_task). Every change is posted to the thread. */
export async function updateTask(actor: TaskActor, id: string, patch: TaskPatch): Promise<AgentTask> {
  const t = await getTask(id);
  if (!canManageTask(actor, t)) throw new TaskError(403, "not_allowed", `Task ${id} is assigned to ${t.claimed_by ?? t.owner_agent}; only that agent or a team owner can edit it.`);
  const upd: Record<string, unknown> = {}; const changes: string[] = [];
  if (patch.title !== undefined) { const title = patch.title.trim().slice(0, 200); if (title.length < 3) throw new TaskError(400, "invalid_title", "Title must be at least 3 characters."); if (title !== t.title) { upd.title = title; changes.push(`title → "${title}"`); } }
  if (patch.context !== undefined) { const c = patch.context === null ? null : patch.context.slice(0, 20000); if (c !== t.context) { upd.context = c; changes.push("context updated"); } }
  if (patch.priority !== undefined) { if (!PRIORITIES.includes(patch.priority)) throw new TaskError(400, "invalid_priority", `priority must be one of ${PRIORITIES.join(", ")}.`); if (patch.priority !== t.priority) { upd.priority = patch.priority; changes.push(`priority ${t.priority} → ${patch.priority}`); } }
  if (patch.due !== undefined) { const d = isoOrNull(patch.due); if (d !== undefined && d !== t.due) { upd.due = d; changes.push(`due → ${d ?? "none"}`); } }
  if (patch.owner_agent !== undefined) {
    if (!isAgentHandle(patch.owner_agent)) throw new TaskError(400, "invalid_owner", `owner_agent must be one of ${AGENT_HANDLES.join(", ")}.`);
    if (patch.owner_agent !== t.owner_agent) {
      upd.owner_agent = patch.owner_agent; changes.push(`reassigned ${t.owner_agent} → ${patch.owner_agent}`);
      if (t.claimed_by && t.claimed_by !== patch.owner_agent) { upd.claimed_by = null; upd.claimed_at = null; if (["claimed", "in_progress"].includes(t.status) && patch.status === undefined) { upd.status = "open"; changes.push("back to open for the new owner"); } }
      if (t.requires_review && t.reviewer_agent === patch.owner_agent) { upd.reviewer_agent = patch.owner_agent === "atlas" ? "hyperagent" : "atlas"; changes.push(`reviewer → ${upd.reviewer_agent}`); }
    }
  }
  if (patch.status !== undefined) {
    if (!UPDATABLE_STATUSES.includes(patch.status)) throw new TaskError(400, "invalid_status", `update_task can set ${UPDATABLE_STATUSES.join(", ")}. done needs review_task; claimed / in_review come from claim_task / post_result.`);
    if (patch.status !== t.status) { upd.status = patch.status; changes.push(`status ${t.status} → ${patch.status}`); if (patch.status === "closed") { upd.closed_by = actor.handle; upd.closed_at = new Date().toISOString(); } }
  }
  if (changes.length === 0) return t;
  const { data, error } = await db().from("agent_tasks").update(upd).eq("id", id).select(COLS).single();
  if (error || !data) throw new TaskError(error?.code === "42501" ? 403 : 500, "update_failed", error?.message ?? "Could not update task.");
  await db().from("agent_messages").insert({ task_id: id, from_agent: actor.handle, to_agent: null, body: `Updated by ${actor.handle}: ${changes.join("; ")}.` });
  emitIntegrationEvent("task.updated", { task_id: id, updated_by: actor.handle, changes });
  return data as AgentTask;
}

export async function sendMessage(by: AgentHandle, taskId: string, body: string, to?: AgentHandle | null) {
  await getTask(taskId);
  const text = body.trim();
  if (!text) throw new TaskError(400, "empty", "Message body is empty.");
  const { data, error } = await db().from("agent_messages").insert({ task_id: taskId, from_agent: by, to_agent: to ?? null, body: text.slice(0, 20000) }).select("id, task_id, from_agent, to_agent, body, created_at").single();
  if (error || !data) throw new TaskError(500, "message_failed", error?.message ?? "Could not send.");
  return data;
}

export async function listMessages(taskId: string, limit = 100) {
  const { data, error } = await db().from("agent_messages").select("id, task_id, from_agent, to_agent, body, created_at").eq("task_id", taskId).order("created_at").limit(limit);
  if (error) throw new TaskError(500, "messages_failed", error.message);
  return data ?? [];
}

/** Unread-ish inbox: messages addressed to an agent (or broadcast on its tasks) in the last N days. */
export async function inbox(agent: AgentHandle, days = 7) {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const { data, error } = await db().from("agent_messages").select("id, task_id, from_agent, to_agent, body, created_at").gte("created_at", since).or(`to_agent.eq.${agent},to_agent.is.null`).neq("from_agent", agent).order("created_at", { ascending: false }).limit(100);
  if (error) throw new TaskError(500, "inbox_failed", error.message);
  return data ?? [];
}
