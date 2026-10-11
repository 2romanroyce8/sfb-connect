// ============================================================
// CLIENT PROJECT GRAPH — types + pure layout.
// Nodes: client → task → (subtasks: dashed) + notes + roles. Positions the
// user dragged win; everything else gets a deterministic auto-layout. Pure
// so it is unit-tested and shared by the internal and (later) client views.
// ============================================================

export type ProjectStatus = "active" | "paused" | "done";
export type TaskStatus = "planned" | "in_progress" | "in_review" | "done" | "blocked";
export type Approval = "not_requested" | "pending" | "approved" | "rejected";
export const PROJECT_STATUSES: ProjectStatus[] = ["active", "paused", "done"];
export const TASK_STATUSES: TaskStatus[] = ["planned", "in_progress", "in_review", "done", "blocked"];
export const APPROVALS: Approval[] = ["not_requested", "pending", "approved", "rejected"];

export type Person = { id: string; name: string; avatar_url: string | null };
export type Subtask = { id: string; task_id: string; title: string; done: boolean; assignees: string[]; tech_stack: string[]; sort_order: number; created_at: string; updated_at: string };
export type ProjectTask = { id: string; project_id: string; title: string; description: string | null; status: TaskStatus; assignees: string[]; tech_stack: string[]; internal_note: string | null; client_approval: Approval; client_approval_note: string | null; client_approved_at: string | null; sort_order: number; created_at: string; updated_at: string; subtasks: Subtask[] };
export type Note = { id: string; project_id: string; task_id: string | null; body: string; author_kind: "client" | "team"; author_id: string | null; created_at: string; updated_at: string };
export type Role = { id: string; project_id: string; task_id: string | null; role_title: string; person_user_id: string | null; person_name: string | null; blurb: string | null; tech_stack: string[]; sort_order: number; created_at: string; updated_at: string };
export type Positions = Record<string, { x: number; y: number }>;
export type Project = { id: string; business_id: string; name: string; status: ProjectStatus; summary: string | null; positions: Positions; created_at: string; updated_at: string };
export type ClientSpace = { id: string; name: string; logo_url: string | null; onboarded_at: string; slug: string | null; plan_key: string | null };
export type ProjectGraph = { project: Project; client: ClientSpace; tasks: ProjectTask[]; notes: Note[]; roles: Role[]; people: Person[] };

export type NodeKind = "client" | "task" | "subtasks" | "notes" | "role";
export type GraphNode = { id: string; kind: NodeKind; x: number; y: number; w: number; ref: string | null; auto: boolean };
export type GraphEdge = { id: string; from: string; to: string; style: "solid" | "dashed"; label?: string; fromSide: "bottom" | "right" | "left"; toSide: "top" | "left" | "right" };

export const NODE_W: Record<NodeKind, number> = { client: 280, task: 320, subtasks: 300, notes: 240, role: 260 };
const COL_W = 760; const TASK_Y = 150; const BELOW_Y = 330; const ROLE_GAP = 120;

export const nodeId = { client: () => "client", task: (id: string) => `task:${id}`, subtasks: (taskId: string) => `subtasks:${taskId}`, notes: (taskId: string | null) => `notes:${taskId ?? "project"}`, role: (id: string) => `role:${id}` };

/** Deterministic tree layout; any id present in `positions` keeps the user's coordinates. */
export function layoutGraph(g: ProjectGraph, positions: Positions = g.project.positions ?? {}): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = []; const edges: GraphEdge[] = [];
  const place = (id: string, kind: NodeKind, x: number, y: number, ref: string | null = null) => {
    const p = positions[id]; nodes.push({ id, kind, x: p?.x ?? x, y: p?.y ?? y, w: NODE_W[kind], ref, auto: !p });
  };
  const tasks = [...g.tasks].sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
  const cols = Math.max(1, tasks.length);
  const totalW = (cols - 1) * COL_W + NODE_W.task;
  const clientX = Math.round(totalW / 2 - NODE_W.client / 2);
  place(nodeId.client(), "client", clientX, 0);

  const projectNotes = g.notes.filter((n) => !n.task_id);
  if (projectNotes.length) { place(nodeId.notes(null), "notes", clientX + NODE_W.client + 60, 0, null); edges.push({ id: "e:client-notes", from: nodeId.client(), to: nodeId.notes(null), style: "solid", fromSide: "right", toSide: "left" }); }
  const projectRoles = g.roles.filter((r) => !r.task_id).sort((a, b) => a.sort_order - b.sort_order);
  projectRoles.forEach((r, i) => { const id = nodeId.role(r.id); place(id, "role", clientX + NODE_W.client + 60, 90 + i * ROLE_GAP, r.id); edges.push({ id: `e:client-${id}`, from: nodeId.client(), to: id, style: "solid", label: i === 0 ? "Assigned roles" : undefined, fromSide: "right", toSide: "left" }); });

  tasks.forEach((t, col) => {
    const tx = col * COL_W; const tid = nodeId.task(t.id);
    place(tid, "task", tx, TASK_Y, t.id);
    edges.push({ id: `e:client-${tid}`, from: nodeId.client(), to: tid, style: "solid", fromSide: "bottom", toSide: "top" });
    if (t.subtasks.length) { const sid = nodeId.subtasks(t.id); place(sid, "subtasks", tx - 60, BELOW_Y, t.id); edges.push({ id: `e:${tid}-sub`, from: tid, to: sid, style: "dashed", fromSide: "bottom", toSide: "top" }); }
    const notes = g.notes.filter((n) => n.task_id === t.id);
    if (notes.length) { const nid = nodeId.notes(t.id); place(nid, "notes", tx + NODE_W.task + 70, TASK_Y + 20, t.id); edges.push({ id: `e:${tid}-notes`, from: tid, to: nid, style: "solid", fromSide: "right", toSide: "left" }); }
    const roles = g.roles.filter((r) => r.task_id === t.id).sort((a, b) => a.sort_order - b.sort_order);
    roles.forEach((r, i) => { const rid = nodeId.role(r.id); place(rid, "role", tx + NODE_W.task + 70, BELOW_Y + i * ROLE_GAP, r.id); edges.push({ id: `e:${tid}-${rid}`, from: i === 0 ? tid : nodeId.role(roles[i - 1].id), to: rid, style: "solid", label: i === 0 ? "Assigned roles" : undefined, fromSide: "bottom", toSide: "top" }); });
  });
  return { nodes, edges };
}

/** Bounding box of a layout (for fit-to-view / mobile fallbacks). */
export function graphBounds(nodes: GraphNode[], estHeight = (k: NodeKind) => (k === "task" ? 140 : k === "subtasks" ? 160 : k === "role" ? 100 : 60)) {
  if (!nodes.length) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return { minX: Math.min(...nodes.map((n) => n.x)), minY: Math.min(...nodes.map((n) => n.y)), maxX: Math.max(...nodes.map((n) => n.x + n.w)), maxY: Math.max(...nodes.map((n) => n.y + estHeight(n.kind))) };
}

/** "Figma, Next.js, Supabase" → ["Figma", "Next.js", "Supabase"] (max 12, 32 chars each, de-duplicated). */
export function parseTechStack(v: unknown): string[] {
  const list = Array.isArray(v) ? v : typeof v === "string" ? v.split(/[,\n]/) : [];
  const out: string[] = []; const seen = new Set<string>();
  for (const raw of list) { const s = String(raw).replace(/\s+/g, " ").trim().slice(0, 32); if (!s || seen.has(s.toLowerCase())) continue; seen.add(s.toLowerCase()); out.push(s); if (out.length >= 12) break; }
  return out;
}

export const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";

/** The client-facing projection: internal-only fields removed. Shared with the client view later; tested now so it cannot drift. */
export function clientSafeGraph(g: ProjectGraph): Omit<ProjectGraph, "tasks"> & { tasks: Omit<ProjectTask, "internal_note">[] } {
  return { ...g, tasks: g.tasks.map(({ internal_note: _internal, ...t }) => t) };
}
