import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import * as P from "@/lib/projects/store";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Internal project graph API (/team/projects). Any team member reads and
// edits; deleting a whole project is owner-only. Every write names the
// project it acts on and the store re-checks that children belong to it.
async function who() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: me } = await supabase.from("users").select("team_role").eq("id", user.id).single();
  return me?.team_role ? { userId: user.id, isOwner: me.team_role === "owner" } : null;
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
    return NextResponse.json({ ok: true, graph: await P.loadGraph(db, projectId) });
  } catch (e) {
    if (e instanceof P.ProjectError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    console.error("[projects]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Request failed. It was logged." }, { status: 500 });
  }
}
