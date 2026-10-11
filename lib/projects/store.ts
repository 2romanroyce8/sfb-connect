import type { SupabaseClient } from "@supabase/supabase-js";
import { APPROVALS, PROJECT_STATUSES, TASK_STATUSES, parseTechStack, type Approval, type ClientSpace, type Note, type Person, type Positions, type Project, type ProjectGraph, type ProjectStatus, type ProjectTask, type Role, type Subtask, type TaskStatus } from "./graph";

// Data access for the client project graph. Service-role writes; every write
// is scoped by project id and re-validated server-side. Team members get the
// full graph; the client projection is `clientSafeGraph` in graph.ts.

export class ProjectError extends Error { constructor(public code: string, message: string, public status = 400) { super(message); } }
const s = (v: unknown, max = 200) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const text = (v: unknown, max = 5000) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const uuids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x)).slice(0, 20) : []);

export async function listClientSpaces(db: SupabaseClient): Promise<ClientSpace[]> {
  const { data } = await db.from("businesses").select("id, legal_name, brand_logo_url, created_at, slug, plan_key").not("plan_key", "is", null).order("created_at", { ascending: false });
  return (data ?? []).map((b) => ({ id: b.id, name: b.legal_name, logo_url: b.brand_logo_url ?? null, onboarded_at: b.created_at, slug: b.slug ?? null, plan_key: b.plan_key }));
}

export async function listProjects(db: SupabaseClient, businessId: string): Promise<Project[]> {
  const { data } = await db.from("client_projects").select("*").eq("business_id", businessId).order("created_at", { ascending: false });
  return (data ?? []) as Project[];
}

export async function listPeople(db: SupabaseClient): Promise<Person[]> {
  const { data } = await db.from("users").select("id, full_name, email, avatar_url").not("team_role", "is", null).order("full_name");
  return (data ?? []).map((u) => ({ id: u.id, name: u.full_name || u.email, avatar_url: u.avatar_url ?? null }));
}

export async function loadGraph(db: SupabaseClient, projectId: string): Promise<ProjectGraph> {
  const { data: project } = await db.from("client_projects").select("*").eq("id", projectId).maybeSingle();
  if (!project) throw new ProjectError("not_found", "Project not found.", 404);
  const [{ data: biz }, { data: tasks }, { data: notes }, { data: roles }, people] = await Promise.all([
    db.from("businesses").select("id, legal_name, brand_logo_url, created_at, slug, plan_key").eq("id", project.business_id).single(),
    db.from("client_project_tasks").select("*").eq("project_id", projectId).order("sort_order").order("created_at"),
    db.from("client_project_notes").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
    db.from("client_project_roles").select("*").eq("project_id", projectId).order("sort_order").order("created_at"),
    listPeople(db),
  ]);
  const taskIds = (tasks ?? []).map((t) => t.id);
  const { data: subs } = taskIds.length ? await db.from("client_project_subtasks").select("*").in("task_id", taskIds).order("sort_order").order("created_at") : { data: [] as Subtask[] };
  const byTask = new Map<string, Subtask[]>(); for (const st of (subs ?? []) as Subtask[]) { if (!byTask.has(st.task_id)) byTask.set(st.task_id, []); byTask.get(st.task_id)!.push(st); }
  return {
    project: project as Project,
    client: { id: biz!.id, name: biz!.legal_name, logo_url: biz!.brand_logo_url ?? null, onboarded_at: biz!.created_at, slug: biz!.slug ?? null, plan_key: biz!.plan_key },
    tasks: ((tasks ?? []) as ProjectTask[]).map((t) => ({ ...t, subtasks: byTask.get(t.id) ?? [] })),
    notes: (notes ?? []) as Note[], roles: (roles ?? []) as Role[], people,
  };
}

export type Actor = { userId: string; isOwner: boolean };

export async function createProject(db: SupabaseClient, actor: Actor, input: Record<string, unknown>): Promise<Project> {
  const businessId = s(input.business_id, 40); const name = s(input.name, 120);
  if (!/^[0-9a-f-]{36}$/i.test(businessId)) throw new ProjectError("invalid", "Pick a client space.");
  if (name.length < 2) throw new ProjectError("invalid", "Project name must be at least 2 characters.");
  const { data: biz } = await db.from("businesses").select("id").eq("id", businessId).not("plan_key", "is", null).maybeSingle();
  if (!biz) throw new ProjectError("invalid", "That client space doesn't exist.", 404);
  const { data, error } = await db.from("client_projects").insert({ business_id: businessId, name, summary: text(input.summary, 2000) || null, created_by: actor.userId }).select("*").single();
  if (error || !data) throw new ProjectError("db", error?.message ?? "Could not create project.", 500);
  return data as Project;
}

export async function updateProject(db: SupabaseClient, projectId: string, input: Record<string, unknown>) {
  const upd: Record<string, unknown> = {};
  if (input.name !== undefined) { const n = s(input.name, 120); if (n.length < 2) throw new ProjectError("invalid", "Project name must be at least 2 characters."); upd.name = n; }
  if (input.summary !== undefined) upd.summary = text(input.summary, 2000) || null;
  if (input.status !== undefined) { if (!PROJECT_STATUSES.includes(input.status as ProjectStatus)) throw new ProjectError("invalid", "Bad status."); upd.status = input.status; }
  if (Object.keys(upd).length) { const { error } = await db.from("client_projects").update(upd).eq("id", projectId); if (error) throw new ProjectError("db", error.message, 500); }
}

export async function deleteProject(db: SupabaseClient, actor: Actor, projectId: string) {
  if (!actor.isOwner) throw new ProjectError("forbidden", "Only the owner can delete a project.", 403);
  const { error } = await db.from("client_projects").delete().eq("id", projectId); if (error) throw new ProjectError("db", error.message, 500);
}

/** Positions: merge (one or many node ids); `reset: true` clears everything → auto-layout. */
export async function setPositions(db: SupabaseClient, projectId: string, input: Record<string, unknown>) {
  if (input.reset === true) { await db.from("client_projects").update({ positions: {} }).eq("id", projectId); return; }
  const incoming = (input.positions && typeof input.positions === "object" ? input.positions : {}) as Record<string, { x?: unknown; y?: unknown }>;
  const { data } = await db.from("client_projects").select("positions").eq("id", projectId).single();
  const merged: Positions = { ...((data?.positions as Positions) ?? {}) };
  for (const [id, p] of Object.entries(incoming)) { if (!/^[a-z]+:[0-9a-f-]{1,36}$|^client$/i.test(id)) continue; const x = Number(p?.x), y = Number(p?.y); if (Number.isFinite(x) && Number.isFinite(y)) merged[id] = { x: Math.round(x), y: Math.round(y) }; }
  await db.from("client_projects").update({ positions: merged }).eq("id", projectId);
}

async function nextOrder(db: SupabaseClient, table: string, col: string, id: string) {
  const { data } = await db.from(table).select("sort_order").eq(col, id).order("sort_order", { ascending: false }).limit(1).maybeSingle();
  return ((data?.sort_order as number | undefined) ?? -1) + 1;
}

export async function addTask(db: SupabaseClient, projectId: string, input: Record<string, unknown>) {
  const title = s(input.title, 160); if (title.length < 2) throw new ProjectError("invalid", "Task title must be at least 2 characters.");
  const { data, error } = await db.from("client_project_tasks").insert({ project_id: projectId, title, description: text(input.description) || null, status: TASK_STATUSES.includes(input.status as TaskStatus) ? input.status : "planned", assignees: uuids(input.assignees), tech_stack: parseTechStack(input.tech_stack), internal_note: text(input.internal_note) || null, sort_order: await nextOrder(db, "client_project_tasks", "project_id", projectId) }).select("id").single();
  if (error || !data) throw new ProjectError("db", error?.message ?? "Could not add task.", 500);
  return data.id as string;
}

export async function updateTask(db: SupabaseClient, projectId: string, taskId: string, input: Record<string, unknown>) {
  const upd: Record<string, unknown> = {};
  if (input.title !== undefined) { const t = s(input.title, 160); if (t.length < 2) throw new ProjectError("invalid", "Task title must be at least 2 characters."); upd.title = t; }
  if (input.description !== undefined) upd.description = text(input.description) || null;
  if (input.status !== undefined) { if (!TASK_STATUSES.includes(input.status as TaskStatus)) throw new ProjectError("invalid", "Bad status."); upd.status = input.status; }
  if (input.assignees !== undefined) upd.assignees = uuids(input.assignees);
  if (input.tech_stack !== undefined) upd.tech_stack = parseTechStack(input.tech_stack);
  if (input.internal_note !== undefined) upd.internal_note = text(input.internal_note) || null;
  if (input.client_approval !== undefined) { if (!APPROVALS.includes(input.client_approval as Approval)) throw new ProjectError("invalid", "Bad approval state."); upd.client_approval = input.client_approval; if (input.client_approval === "not_requested" || input.client_approval === "pending") { upd.client_approval_note = null; upd.client_approved_at = null; } }
  if (input.sort_order !== undefined && Number.isFinite(Number(input.sort_order))) upd.sort_order = Math.max(0, Math.round(Number(input.sort_order)));
  if (!Object.keys(upd).length) return;
  const { error, data } = await db.from("client_project_tasks").update(upd).eq("id", taskId).eq("project_id", projectId).select("id"); if (error) throw new ProjectError("db", error.message, 500);
  if (!data?.length) throw new ProjectError("not_found", "Task not found in this project.", 404);
}
export async function deleteTask(db: SupabaseClient, projectId: string, taskId: string) { const { error } = await db.from("client_project_tasks").delete().eq("id", taskId).eq("project_id", projectId); if (error) throw new ProjectError("db", error.message, 500); }

async function taskInProject(db: SupabaseClient, projectId: string, taskId: string) {
  const { data } = await db.from("client_project_tasks").select("id").eq("id", taskId).eq("project_id", projectId).maybeSingle();
  if (!data) throw new ProjectError("not_found", "Task not found in this project.", 404);
}
export async function addSubtask(db: SupabaseClient, projectId: string, input: Record<string, unknown>) {
  const taskId = s(input.task_id, 40); await taskInProject(db, projectId, taskId);
  const title = s(input.title, 160); if (title.length < 2) throw new ProjectError("invalid", "Subtask title must be at least 2 characters.");
  const { error } = await db.from("client_project_subtasks").insert({ task_id: taskId, title, assignees: uuids(input.assignees), tech_stack: parseTechStack(input.tech_stack), sort_order: await nextOrder(db, "client_project_subtasks", "task_id", taskId) }); if (error) throw new ProjectError("db", error.message, 500);
}
export async function updateSubtask(db: SupabaseClient, projectId: string, subtaskId: string, input: Record<string, unknown>) {
  const { data: st } = await db.from("client_project_subtasks").select("id, task_id").eq("id", subtaskId).maybeSingle(); if (!st) throw new ProjectError("not_found", "Subtask not found.", 404);
  await taskInProject(db, projectId, st.task_id);
  const upd: Record<string, unknown> = {};
  if (input.title !== undefined) { const t = s(input.title, 160); if (t.length < 2) throw new ProjectError("invalid", "Subtask title must be at least 2 characters."); upd.title = t; }
  if (input.done !== undefined) upd.done = input.done === true;
  if (input.assignees !== undefined) upd.assignees = uuids(input.assignees);
  if (input.tech_stack !== undefined) upd.tech_stack = parseTechStack(input.tech_stack);
  if (Object.keys(upd).length) { const { error } = await db.from("client_project_subtasks").update(upd).eq("id", subtaskId); if (error) throw new ProjectError("db", error.message, 500); }
}
export async function deleteSubtask(db: SupabaseClient, projectId: string, subtaskId: string) {
  const { data: st } = await db.from("client_project_subtasks").select("task_id").eq("id", subtaskId).maybeSingle(); if (!st) return;
  await taskInProject(db, projectId, st.task_id);
  const { error } = await db.from("client_project_subtasks").delete().eq("id", subtaskId); if (error) throw new ProjectError("db", error.message, 500);
}

export async function addNote(db: SupabaseClient, projectId: string, actor: Actor, input: Record<string, unknown>, authorKind: "team" | "client") {
  const body = text(input.body, 5000); if (!body) throw new ProjectError("invalid", "Note is empty.");
  const taskId = s(input.task_id, 40) || null; if (taskId) await taskInProject(db, projectId, taskId);
  const { error } = await db.from("client_project_notes").insert({ project_id: projectId, task_id: taskId, body, author_kind: authorKind, author_id: actor.userId }); if (error) throw new ProjectError("db", error.message, 500);
}
export async function updateNote(db: SupabaseClient, projectId: string, noteId: string, input: Record<string, unknown>) {
  const body = text(input.body, 5000); if (!body) throw new ProjectError("invalid", "Note is empty.");
  const { error, data } = await db.from("client_project_notes").update({ body }).eq("id", noteId).eq("project_id", projectId).select("id"); if (error) throw new ProjectError("db", error.message, 500);
  if (!data?.length) throw new ProjectError("not_found", "Note not found.", 404);
}
export async function deleteNote(db: SupabaseClient, projectId: string, noteId: string) { const { error } = await db.from("client_project_notes").delete().eq("id", noteId).eq("project_id", projectId); if (error) throw new ProjectError("db", error.message, 500); }

export async function addRole(db: SupabaseClient, projectId: string, input: Record<string, unknown>) {
  const role_title = s(input.role_title, 80); if (role_title.length < 2) throw new ProjectError("invalid", "Role title must be at least 2 characters.");
  const taskId = s(input.task_id, 40) || null; if (taskId) await taskInProject(db, projectId, taskId);
  const person_user_id = /^[0-9a-f-]{36}$/i.test(s(input.person_user_id, 40)) ? s(input.person_user_id, 40) : null; const person_name = s(input.person_name, 80) || null;
  if (!person_user_id && !person_name) throw new ProjectError("invalid", "Pick a team member or type a name.");
  const { error } = await db.from("client_project_roles").insert({ project_id: projectId, task_id: taskId, role_title, person_user_id, person_name, blurb: s(input.blurb, 120) || null, tech_stack: parseTechStack(input.tech_stack), sort_order: await nextOrder(db, "client_project_roles", "project_id", projectId) }); if (error) throw new ProjectError("db", error.message, 500);
}
export async function updateRole(db: SupabaseClient, projectId: string, roleId: string, input: Record<string, unknown>) {
  const upd: Record<string, unknown> = {};
  if (input.role_title !== undefined) { const t = s(input.role_title, 80); if (t.length < 2) throw new ProjectError("invalid", "Role title must be at least 2 characters."); upd.role_title = t; }
  if (input.person_user_id !== undefined) upd.person_user_id = /^[0-9a-f-]{36}$/i.test(s(input.person_user_id, 40)) ? s(input.person_user_id, 40) : null;
  if (input.person_name !== undefined) upd.person_name = s(input.person_name, 80) || null;
  if (input.blurb !== undefined) upd.blurb = s(input.blurb, 120) || null;
  if (input.tech_stack !== undefined) upd.tech_stack = parseTechStack(input.tech_stack);
  if (input.task_id !== undefined) { const tid = s(input.task_id, 40) || null; if (tid) await taskInProject(db, projectId, tid); upd.task_id = tid; }
  if (!Object.keys(upd).length) return;
  const { error, data } = await db.from("client_project_roles").update(upd).eq("id", roleId).eq("project_id", projectId).select("id"); if (error) throw new ProjectError("db", error.message, 500);
  if (!data?.length) throw new ProjectError("not_found", "Role not found.", 404);
}
export async function deleteRole(db: SupabaseClient, projectId: string, roleId: string) { const { error } = await db.from("client_project_roles").delete().eq("id", roleId).eq("project_id", projectId); if (error) throw new ProjectError("db", error.message, 500); }
