"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ProjectGraph, { ProjectCards, type Selection } from "./ProjectGraph";
import { TASK_STATUSES, APPROVALS, type ClientSpace, type Project, type ProjectGraph as Graph, type Positions, type Person, type ProjectTask } from "@/lib/projects/graph";

// /team/projects — internal view. Client-space switcher → project switcher →
// graph (desktop) or stacked cards (mobile) → side drawer for every edit.
// Positions save ~600 ms after the last drag; "Auto-layout" clears them.

type Payload = { me: { userId: string; isOwner: boolean }; spaces: ClientSpace[]; businessId: string | null; projects: Project[]; graph: Graph | null; people: Person[] };
const field: React.CSSProperties = { background: "#0F0F0F", border: "1px solid rgba(255,255,255,0.12)", color: "#F5F5F7" };
const inp = "h-[34px] rounded-[8px] px-2.5 text-[12.5px] outline-none w-full";
const lab = "text-[10.5px] uppercase tracking-[0.1em] text-[#6E6E73] font-semibold mt-3 mb-1";
const btnP = "h-[32px] px-3.5 rounded-[8px] bg-white text-black text-[12.5px] font-semibold disabled:opacity-50";
const btnS = "h-[32px] px-3 rounded-[8px] text-[12.5px] text-white/[0.85]";
const btnD = "text-[12px] text-[#FF6961] underline underline-offset-2";

export default function ProjectsWorkspace() {
  const [data, setData] = useState<Payload | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null); const [projectId, setProjectId] = useState<string | null>(null);
  const [positions, setPositions] = useState<Positions>({});
  const [sel, setSel] = useState<Selection | null>(null);
  const [msg, setMsg] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false); const [newName, setNewName] = useState(""); const [newSummary, setNewSummary] = useState("");
  const [mobile, setMobile] = useState(false);
  const pending = useRef<Positions>({}); const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { const mq = window.matchMedia("(max-width: 767px)"); const f = () => setMobile(mq.matches); f(); mq.addEventListener("change", f); return () => mq.removeEventListener("change", f); }, []);

  const load = useCallback(async (b?: string | null, p?: string | null) => {
    const q = new URLSearchParams(); if (b) q.set("business", b); if (p) q.set("project", p);
    const r = await fetch(`/api/team/projects?${q}`, { cache: "no-store" }); const j = (await r.json()) as Payload & { error?: string };
    if (!r.ok) { setMsg(j.error ?? "Could not load."); return; }
    setData(j); setBusinessId(j.businessId); setProjectId(j.graph?.project.id ?? null); setPositions(j.graph?.project.positions ?? {});
  }, []);
  useEffect(() => { void load(); }, [load]);

  const act = async (body: Record<string, unknown>, opts: { silent?: boolean } = {}) => {
    if (!opts.silent) { setBusy(true); setMsg(null); }
    try {
      const r = await fetch("/api/team/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project_id: projectId, ...body }) });
      const j = (await r.json()) as { ok?: boolean; error?: string; graph?: Graph; project?: Project; deleted?: boolean };
      if (!r.ok) { setMsg(j.error ?? "Request failed."); return null; }
      if (j.graph && !opts.silent) { setData((d) => (d ? { ...d, graph: j.graph! } : d)); setPositions(j.graph.project.positions ?? {}); }
      return j;
    } finally { if (!opts.silent) setBusy(false); }
  };

  const onMove = (id: string, x: number, y: number) => {
    setPositions((p) => ({ ...p, [id]: { x, y } })); pending.current[id] = { x, y };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { const batch = pending.current; pending.current = {}; void act({ action: "set_positions", positions: batch }, { silent: true }); }, 600);
  };
  const autoLayout = async () => { await act({ action: "set_positions", reset: true }); setPositions({}); };

  const createProject = async (e: React.FormEvent) => {
    e.preventDefault(); if (!businessId) return;
    const j = await act({ action: "create_project", business_id: businessId, name: newName, summary: newSummary });
    if (j?.project) { setCreating(false); setNewName(""); setNewSummary(""); await load(businessId, j.project.id); }
  };

  if (!data) return <div className="text-[13px] text-[#6E6E73]">{msg ?? "Loading…"}</div>;
  const g = data.graph; const space = data.spaces.find((s) => s.id === businessId) ?? null;

  return (
    <div className="h-full">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div><h1 className="text-[22px] font-semibold text-[#F5F5F7] tracking-tight">Projects</h1><div className="text-[13px] text-[#6E6E73] mt-1">Client → tasks → subtasks, notes and roles. Drag to arrange; positions persist.</div></div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={businessId ?? ""} onChange={(e) => void load(e.target.value, null)} className="h-[34px] rounded-[8px] px-2 text-[12.5px] outline-none max-w-[240px]" style={field}>{data.spaces.map((s) => <option key={s.id} value={s.id}>{s.name}{s.plan_key === "trial" ? " · trial" : ""}</option>)}{data.spaces.length === 0 && <option value="">No client spaces yet</option>}</select>
          <select value={projectId ?? ""} onChange={(e) => void load(businessId, e.target.value)} className="h-[34px] rounded-[8px] px-2 text-[12.5px] outline-none max-w-[240px]" style={field} disabled={!data.projects.length}>{data.projects.map((p) => <option key={p.id} value={p.id}>{p.name}{p.status !== "active" ? ` · ${p.status}` : ""}</option>)}{data.projects.length === 0 && <option value="">No projects</option>}</select>
          <button type="button" onClick={() => setCreating((c) => !c)} disabled={!businessId} className={btnP}>+ Project</button>
          {g && <button type="button" onClick={() => void autoLayout()} className={btnS} style={{ border: "1px solid rgba(255,255,255,0.16)" }}>Auto-layout</button>}
        </div>
      </div>
      {msg && <div className="text-[12px] text-[#FF9F9A] mb-3">{msg}</div>}
      {creating && businessId && (
        <form onSubmit={createProject} className="rounded-[12px] p-4 mb-4 flex flex-wrap items-end gap-2" style={{ border: "1px solid rgba(255,255,255,0.1)", background: "#0A0A0A" }}>
          <div className="flex-1 min-w-[200px]"><div className={lab}>Project name · {space?.name}</div><input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Website redesign" className={inp} style={field} required minLength={2} /></div>
          <div className="flex-[2] min-w-[240px]"><div className={lab}>Summary (optional)</div><input value={newSummary} onChange={(e) => setNewSummary(e.target.value)} className={inp} style={field} /></div>
          <button type="submit" disabled={busy} className={btnP}>Create</button><button type="button" onClick={() => setCreating(false)} className={btnS}>Cancel</button>
        </form>
      )}

      {!g ? (
        <div className="rounded-[16px] p-10 text-center" style={{ border: "1px dashed rgba(255,255,255,0.14)", background: "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px) 0 0 / 22px 22px, #0A0A0B" }}>
          <div className="text-[15px] text-white font-semibold">{data.spaces.length === 0 ? "No client spaces yet." : `No projects for ${space?.name ?? "this client"} yet.`}</div>
          <div className="text-[13px] text-[#6E6E73] mt-1">{data.spaces.length === 0 ? "A client space appears when a business has a plan (trial or paid)." : "Create the first project to start the graph. Nothing here is sample data."}</div>
        </div>
      ) : (
        <div className={`grid gap-4 ${sel ? "lg:grid-cols-[1fr_360px]" : ""}`}>
          {mobile ? <ProjectCards graph={g} onSelect={setSel} /> : <ProjectGraph graph={g} positions={positions} onMove={onMove} onSelect={setSel} selected={sel ? selKey(sel) : null} />}
          {sel && <Drawer key={selKey(sel)} sel={sel} graph={g} people={data.people} isOwner={data.me.isOwner} busy={busy} act={act} close={() => setSel(null)} onProjectDeleted={() => { setSel(null); void load(businessId, null); }} />}
        </div>
      )}
      {g && !sel && <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => setSel({ kind: "task", id: "" })} className={btnS} style={{ border: "1px solid rgba(255,255,255,0.16)" }}>+ Task</button><button type="button" onClick={() => setSel({ kind: "notes", taskId: null })} className={btnS} style={{ border: "1px solid rgba(255,255,255,0.16)" }}>+ Project note</button><button type="button" onClick={() => setSel({ kind: "role", id: "" })} className={btnS} style={{ border: "1px solid rgba(255,255,255,0.16)" }}>+ Role</button><button type="button" onClick={() => setSel({ kind: "client" })} className={btnS} style={{ border: "1px solid rgba(255,255,255,0.16)" }}>Project settings</button></div>}
    </div>
  );
}
const selKey = (s: Selection) => s.kind === "client" ? "client" : s.kind === "task" ? `task:${s.id}` : s.kind === "subtasks" ? `subtasks:${s.taskId}` : s.kind === "notes" ? `notes:${s.taskId ?? "project"}` : `role:${s.id}`;

type Act = (b: Record<string, unknown>, o?: { silent?: boolean }) => Promise<{ ok?: boolean; graph?: Graph; deleted?: boolean } | null>;
function Drawer({ sel, graph, people, isOwner, busy, act, close, onProjectDeleted }: { sel: Selection; graph: Graph; people: Person[]; isOwner: boolean; busy: boolean; act: Act; close: () => void; onProjectDeleted: () => void }) {
  const shell = (title: string, body: React.ReactNode) => <aside className="rounded-[14px] p-4 h-fit lg:sticky lg:top-4" style={{ border: "1px solid rgba(255,255,255,0.1)", background: "#0A0A0A" }}><div className="flex items-center justify-between mb-1"><div className="text-[13px] font-semibold text-white">{title}</div><button type="button" onClick={close} className="text-[12px] text-white/[0.5] hover:text-white">Close</button></div>{body}</aside>;
  if (sel.kind === "client") return shell("Project", <ProjectForm graph={graph} isOwner={isOwner} busy={busy} act={act} onDeleted={onProjectDeleted} />);
  if (sel.kind === "task") return shell(sel.id ? "Task" : "New task", <TaskForm task={graph.tasks.find((t) => t.id === sel.id) ?? null} people={people} busy={busy} act={act} close={close} />);
  if (sel.kind === "subtasks") return shell("Subtasks", <SubtaskForm task={graph.tasks.find((t) => t.id === sel.taskId)!} people={people} busy={busy} act={act} />);
  if (sel.kind === "notes") return shell(sel.taskId ? "Client Notes · task" : "Client Notes · project", <NotesForm graph={graph} taskId={sel.taskId} busy={busy} act={act} />);
  return shell(sel.id ? "Role" : "New role", <RoleForm role={graph.roles.find((r) => r.id === sel.id) ?? null} graph={graph} people={people} busy={busy} act={act} close={close} />);
}

function PeoplePicker({ value, onChange, people }: { value: string[]; onChange: (v: string[]) => void; people: Person[] }) {
  return <div className="flex flex-wrap gap-1.5">{people.map((p) => { const on = value.includes(p.id); return <button key={p.id} type="button" onClick={() => onChange(on ? value.filter((x) => x !== p.id) : [...value, p.id])} className="text-[11.5px] px-2 py-1 rounded-full" style={{ border: `1px solid ${on ? "#30D158" : "rgba(255,255,255,0.14)"}`, color: on ? "#30D158" : "rgba(255,255,255,0.7)" }}>{p.name}</button>; })}{people.length === 0 && <span className="text-[11.5px] text-white/[0.35]">No team members.</span>}</div>;
}

function ProjectForm({ graph, isOwner, busy, act, onDeleted }: { graph: Graph; isOwner: boolean; busy: boolean; act: Act; onDeleted: () => void }) {
  const p = graph.project; const [name, setName] = useState(p.name); const [summary, setSummary] = useState(p.summary ?? ""); const [status, setStatus] = useState(p.status);
  return <form onSubmit={async (e) => { e.preventDefault(); await act({ action: "update_project", name, summary, status }); }} className="flex flex-col">
    <div className="text-[12px] text-white/[0.5]">Client space: <span className="text-white">{graph.client.name}</span> · onboarded {new Date(graph.client.onboarded_at).toLocaleDateString("en-US")}</div>
    <div className={lab}>Name</div><input value={name} onChange={(e) => setName(e.target.value)} className={inp} style={field} required minLength={2} />
    <div className={lab}>Summary</div><textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} className="rounded-[8px] px-2.5 py-2 text-[12.5px] outline-none" style={field} />
    <div className={lab}>Status</div><select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={inp} style={field}>{["active", "paused", "done"].map((s) => <option key={s}>{s}</option>)}</select>
    <div className="flex items-center justify-between mt-4"><button type="submit" disabled={busy} className={btnP}>Save</button>{isOwner && <button type="button" onClick={async () => { if (confirm(`Delete project "${p.name}" and everything in it?`)) { const j = await act({ action: "delete_project" }); if (j?.deleted) onDeleted(); } }} className={btnD}>Delete project</button>}</div>
  </form>;
}

function TaskForm({ task, people, busy, act, close }: { task: ProjectTask | null; people: Person[]; busy: boolean; act: Act; close: () => void }) {
  const [f, setF] = useState({ title: task?.title ?? "", description: task?.description ?? "", status: task?.status ?? "planned", assignees: task?.assignees ?? [], tech_stack: (task?.tech_stack ?? []).join(", "), internal_note: task?.internal_note ?? "", client_approval: task?.client_approval ?? "not_requested" });
  const set = (k: string, v: unknown) => setF((x) => ({ ...x, [k]: v }));
  return <form onSubmit={async (e) => { e.preventDefault(); const j = await act(task ? { action: "update_task", id: task.id, ...f } : { action: "add_task", ...f }); if (j && !task) close(); }} className="flex flex-col">
    <div className={lab}>Title</div><input value={f.title} onChange={(e) => set("title", e.target.value)} className={inp} style={field} required minLength={2} />
    <div className={lab}>Description</div><textarea value={f.description} onChange={(e) => set("description", e.target.value)} rows={3} className="rounded-[8px] px-2.5 py-2 text-[12.5px] outline-none" style={field} />
    <div className={lab}>Status</div><select value={f.status} onChange={(e) => set("status", e.target.value)} className={inp} style={field}>{TASK_STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</select>
    <div className={lab}>Assigned to</div><PeoplePicker value={f.assignees} onChange={(v) => set("assignees", v)} people={people} />
    <div className={lab}>Tech stack (comma-separated)</div><input value={f.tech_stack} onChange={(e) => set("tech_stack", e.target.value)} placeholder="Figma, Next.js, Supabase" className={inp} style={field} />
    <div className={lab}>Client approval</div><select value={f.client_approval} onChange={(e) => set("client_approval", e.target.value)} className={inp} style={field}>{APPROVALS.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</select>
    {task?.client_approval_note && <div className="text-[11.5px] text-white/[0.5] mt-1">Client said: {task.client_approval_note}</div>}
    <div className={lab}>Internal note <span className="normal-case tracking-normal text-[#FF9F0A]">· never shown to the client</span></div><textarea value={f.internal_note} onChange={(e) => set("internal_note", e.target.value)} rows={2} className="rounded-[8px] px-2.5 py-2 text-[12.5px] outline-none" style={field} />
    <div className="flex items-center justify-between mt-4"><button type="submit" disabled={busy} className={btnP}>{task ? "Save" : "Add task"}</button>{task && <button type="button" onClick={async () => { if (confirm("Delete this task, its subtasks, notes and roles?")) { await act({ action: "delete_task", id: task.id }); close(); } }} className={btnD}>Delete task</button>}</div>
  </form>;
}

function SubtaskForm({ task, people, busy, act }: { task: ProjectTask; people: Person[]; busy: boolean; act: Act }) {
  const [title, setTitle] = useState(""); const [stack, setStack] = useState(""); const [assignees, setAssignees] = useState<string[]>([]);
  return <div className="flex flex-col">
    <div className="text-[12px] text-white/[0.5]">Task: <span className="text-white">{task.title}</span></div>
    <div className="mt-2 flex flex-col gap-1.5">{task.subtasks.map((st, i) => <div key={st.id} className="flex items-center gap-2 rounded-[8px] px-2.5 py-2" style={{ background: "rgba(255,255,255,0.04)" }}><input type="checkbox" checked={st.done} onChange={(e) => void act({ action: "update_subtask", id: st.id, done: e.target.checked })} /><input defaultValue={st.title} onBlur={(e) => { if (e.target.value.trim() !== st.title) void act({ action: "update_subtask", id: st.id, title: e.target.value }); }} className="flex-1 bg-transparent text-[12.5px] text-white outline-none" /><span className="text-[10.5px] text-white/[0.35]">#{i + 1}</span><button type="button" onClick={() => { if (confirm("Delete subtask?")) void act({ action: "delete_subtask", id: st.id }); }} className="text-[11px] text-[#FF6961]">×</button></div>)}{task.subtasks.length === 0 && <div className="text-[12px] text-white/[0.4]">No subtasks yet.</div>}</div>
    <form onSubmit={async (e) => { e.preventDefault(); const j = await act({ action: "add_subtask", task_id: task.id, title, tech_stack: stack, assignees }); if (j) { setTitle(""); setStack(""); setAssignees([]); } }} className="flex flex-col mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
      <div className={lab}>New subtask</div><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Create wireframe" className={inp} style={field} required minLength={2} />
      <div className={lab}>Assigned to</div><PeoplePicker value={assignees} onChange={setAssignees} people={people} />
      <div className={lab}>Tech stack</div><input value={stack} onChange={(e) => setStack(e.target.value)} className={inp} style={field} />
      <button type="submit" disabled={busy} className={`${btnP} mt-3 self-start`}>Add subtask</button>
    </form>
  </div>;
}

function NotesForm({ graph, taskId, busy, act }: { graph: Graph; taskId: string | null; busy: boolean; act: Act }) {
  const list = graph.notes.filter((n) => (taskId ? n.task_id === taskId : !n.task_id)); const [body, setBody] = useState(""); const [kind, setKind] = useState<"client" | "team">("client");
  return <div className="flex flex-col">
    <div className="flex flex-col gap-2">{list.map((n) => <div key={n.id} className="rounded-[8px] px-2.5 py-2" style={{ background: "rgba(255,255,255,0.04)" }}><div className="flex items-center justify-between text-[10.5px] text-white/[0.4]"><span>{n.author_kind === "client" ? "Client" : "Team"} · {new Date(n.updated_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span><button type="button" onClick={() => { if (confirm("Delete note?")) void act({ action: "delete_note", id: n.id }); }} className="text-[#FF6961]">delete</button></div><textarea defaultValue={n.body} rows={3} onBlur={(e) => { if (e.target.value.trim() && e.target.value.trim() !== n.body) void act({ action: "update_note", id: n.id, body: e.target.value }); }} className="w-full bg-transparent text-[12.5px] text-white outline-none mt-1 resize-y" /></div>)}{list.length === 0 && <div className="text-[12px] text-white/[0.4]">No notes yet.</div>}</div>
    <form onSubmit={async (e) => { e.preventDefault(); const j = await act({ action: "add_note", task_id: taskId, body, author_kind: kind }); if (j) setBody(""); }} className="flex flex-col mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
      <div className={lab}>New note</div><textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} className="rounded-[8px] px-2.5 py-2 text-[12.5px] outline-none" style={field} required />
      <div className="flex items-center gap-3 mt-2 text-[12px] text-white/[0.6]"><label className="flex items-center gap-1"><input type="radio" checked={kind === "client"} onChange={() => setKind("client")} />On the client&apos;s behalf</label><label className="flex items-center gap-1"><input type="radio" checked={kind === "team"} onChange={() => setKind("team")} />Team note</label></div>
      <button type="submit" disabled={busy} className={`${btnP} mt-3 self-start`}>Add note</button>
    </form>
  </div>;
}

function RoleForm({ role, graph, people, busy, act, close }: { role: Graph["roles"][number] | null; graph: Graph; people: Person[]; busy: boolean; act: Act; close: () => void }) {
  const [f, setF] = useState({ role_title: role?.role_title ?? "", person_user_id: role?.person_user_id ?? "", person_name: role?.person_name ?? "", blurb: role?.blurb ?? "", tech_stack: (role?.tech_stack ?? []).join(", "), task_id: role?.task_id ?? "" });
  const set = (k: string, v: unknown) => setF((x) => ({ ...x, [k]: v }));
  return <form onSubmit={async (e) => { e.preventDefault(); const j = await act(role ? { action: "update_role", id: role.id, ...f } : { action: "add_role", ...f }); if (j && !role) close(); }} className="flex flex-col">
    <div className={lab}>Role title</div><input value={f.role_title} onChange={(e) => set("role_title", e.target.value)} placeholder="Project Manager" className={inp} style={field} required minLength={2} />
    <div className={lab}>Team member</div><select value={f.person_user_id} onChange={(e) => set("person_user_id", e.target.value)} className={inp} style={field}><option value="">— not a team member —</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
    {!f.person_user_id && <><div className={lab}>Name</div><input value={f.person_name} onChange={(e) => set("person_name", e.target.value)} className={inp} style={field} /></>}
    <div className={lab}>One-line blurb</div><input value={f.blurb} onChange={(e) => set("blurb", e.target.value)} placeholder="Managing project progress" className={inp} style={field} />
    <div className={lab}>Tech stack</div><input value={f.tech_stack} onChange={(e) => set("tech_stack", e.target.value)} className={inp} style={field} />
    <div className={lab}>Attached to</div><select value={f.task_id} onChange={(e) => set("task_id", e.target.value)} className={inp} style={field}><option value="">Whole project</option>{graph.tasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</select>
    <div className="flex items-center justify-between mt-4"><button type="submit" disabled={busy} className={btnP}>{role ? "Save" : "Add role"}</button>{role && <button type="button" onClick={async () => { if (confirm("Remove this role?")) { await act({ action: "delete_role", id: role.id }); close(); } }} className={btnD}>Remove</button>}</div>
  </form>;
}
