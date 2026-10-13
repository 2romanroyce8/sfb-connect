import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import * as P from "@/lib/projects/store";
import { notifyTaskAssigned } from "@/lib/notify/taskAssigned";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Internal project graph API (/team/projects). Any team member reads and
// edits; deleting a whole project is owner-only. Every write names the
// project it acts on and the store re-checks that children belong to it.
async function who() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: me } = await supabase.from("users").select("team_role, full_name, email").eq("id", user.id).single();
  return me?.team_role ? { userId: user.id, isOwner: me.team_role === "owner", label: (me.full_name as string | null) || (me.email as string) } : null;
}

export async function GET(req: NextRequest) {
  const me = await who(); if (!me) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const db = createSupabaseServiceClient();
  const spaces = await P.listClientSpaces(db);
  const businessId = req.nextUrl.searchParams.get("business") || spaces[0]?.id || null;
  const projects = businessId ? await P.listProjects(db, businessId) : [];
  const projectId = req.nextUrl.searchParams.get("project") || projects[0]?.id || null;
  const graph = projectId && projects.some((p) => p.id === projectId) ? await P.loadGraph(db, projectId) : null;
  return NextResponse.json({ me, spaces, businessId, projects, graph, people: graph?.people ?? (await P.listPeople(db)) });
}

export async function POST(req: NextRequest) {
  const me = await who(); if (!me) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const db = createSupabaseServiceClient();
  const action = typeof body.action === "string" ? body.action : "";
  const projectId = typeof body.project_id === "string" ? body.project_id : "";
  const id = typeof body.id === "string" ? body.id : "";
  // Assignee notifications (2026-10-12): remember who was assigned before a task/subtask write so only newly added people are told.
  const wantsAssignees = Array.isArray(body.assignees);
  let prevAssignees: string[] = []; let prevTitle = "";
  if (wantsAssignees && action === "update_task" && id) { const { data } = await db.from("client_project_tasks").select("assignees, title").eq("id", id).maybeSingle(); prevAssignees = (data?.assignees as string[]) ?? []; prevTitle = (data?.title as string) ?? ""; }
  if (wantsAssignees && action === "update_subtask" && id) { const { data } = await db.from("client_project_subtasks").select("assignees, title").eq("id", id).maybeSingle(); prevAssignees = (data?.assignees as string[]) ?? []; prevTitle = (data?.title as string) ?? ""; }
  const afterWrite = async () => {
    if (!wantsAssignees || !["add_task", "update_task", "add_subtask", "update_subtask"].includes(action)) return;
    const next = (body.assignees as unknown[]).filter((x): x is string => typeof x === "string");
    const title = (typeof body.title === "string" && body.title) || prevTitle;
    const isSub = action.endsWith("subtask");
    let taskId = id;
    if (action === "add_task" || action === "add_subtask") { // newest row for this title (store returns nothing)
      const table = isSub ? "client_project_subtasks" : "client_project_tasks";
      const q = db.from(table).select("id").eq("title", title).order("created_at", { ascending: false }).limit(1);
      const { data } = isSub ? await q.eq("task_id", typeof body.task_id === "string" ? body.task_id : "") : await q.eq("project_id", projectId);
      taskId = (data?.[0]?.id as string) ?? "";
    }
    await notifyTaskAssigned(db, { kind: isSub ? "project_subtask" : "project_task", id: taskId, title, url: `/team/projects?project=${projectId}` }, prevAssignees, next, { id: me.userId, label: me.label });
  };
  try {
    if (action === "create_project") { const p = await P.createProject(db, me, body); return NextResponse.json({ ok: true, project: p }); }
    if (!/^[0-9a-f-]{36}$/i.test(projectId)) return NextResponse.json({ error: "project_id required." }, { status: 400 });
    switch (action) {
      case "update_project": await P.updateProject(db, projectId, body); break;
      case "delete_project": await P.deleteProject(db, me, projectId); return NextResponse.json({ ok: true, deleted: true });
      case "set_positions": await P.setPositions(db, projectId, body); break;
      case "add_task": await P.addTask(db, projectId, body); break;
      case "update_task": await P.updateTask(db, projectId, id, body); break;
      case "delete_task": await P.deleteTask(db, projectId, id); break;
      case "add_subtask": await P.addSubtask(db, projectId, body); break;
      case "update_subtask": await P.updateSubtask(db, projectId, id, body); break;
      case "delete_subtask": await P.deleteSubtask(db, projectId, id); break;
      case "add_note": await P.addNote(db, projectId, me, body, body.author_kind === "client" ? "client" : "team"); break;
      case "update_note": await P.updateNote(db, projectId, id, body); break;
      case "delete_note": await P.deleteNote(db, projectId, id); break;
      case "add_role": await P.addRole(db, projectId, body); break;
      case "update_role": await P.updateRole(db, projectId, id, body); break;
      case "delete_role": await P.deleteRole(db, projectId, id); break;
      default: return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
    await afterWrite();
    return NextResponse.json({ ok: true, graph: await P.loadGraph(db, projectId) });
  } catch (e) {
    if (e instanceof P.ProjectError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    console.error("[projects]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Request failed. It was logged." }, { status: 500 });
  }
}
