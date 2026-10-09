import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import * as Q from "@/lib/agent/tasks/queue";
export const dynamic = "force-dynamic";

// Team-facing task board API. Reads use the signed-in user's RLS (team
// members). Writes are owner-only and act as the "roman" handle -- the
// owner can create/cancel tasks and review anything, but the self-review
// rule still holds at the database for agent-posted results.
async function who() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: me } = await supabase.from("users").select("team_role").eq("id", user.id).single();
  return me?.team_role ? { supabase, isOwner: me.team_role === "owner" } : null;
}

export async function GET(req: NextRequest) {
  const w = await who();
  if (!w) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const q = req.nextUrl.searchParams;
  const taskId = q.get("task_id");
  if (taskId) {
    const { data: task } = await w.supabase.from("agent_tasks").select("*").eq("id", taskId).maybeSingle();
    if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const { data: messages } = await w.supabase.from("agent_messages").select("*").eq("task_id", taskId).order("created_at");
    return NextResponse.json({ task, messages: messages ?? [] });
  }
  let sel = w.supabase.from("agent_tasks").select("*").order("created_at", { ascending: false }).limit(200);
  if (q.get("status")) sel = sel.in("status", q.get("status")!.split(","));
  if (q.get("owner_agent")) sel = sel.eq("owner_agent", q.get("owner_agent")!);
  const { data, error } = await sel;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tasks: data ?? [] });
}

export async function POST(req: NextRequest) {
  const w = await who();
  if (!w) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!w.isOwner) return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const action = String(b.action ?? "create");
    if (action === "create") return NextResponse.json({ task: await Q.createTask("roman", { title: String(b.title ?? ""), owner_agent: b.owner_agent as Q.AgentHandle, context: typeof b.context === "string" ? b.context : undefined, priority: (b.priority as Q.TaskPriority) || "normal", due: typeof b.due === "string" && b.due ? b.due : null, requires_review: b.requires_review !== false }) });
    if (action === "review") return NextResponse.json({ task: await Q.reviewTask("roman", String(b.task_id), b.verdict as "approved" | "changes_requested" | "rejected", typeof b.note === "string" ? b.note : undefined) });
    if (action === "cancel") return NextResponse.json({ task: await Q.cancelTask("roman", String(b.task_id), typeof b.reason === "string" ? b.reason : undefined) });
    if (action === "message") return NextResponse.json({ message: await Q.sendMessage("roman", String(b.task_id), String(b.body ?? ""), (b.to_agent as Q.AgentHandle) || null) });
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    if (e instanceof Q.TaskError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    return NextResponse.json({ error: "Request failed" }, { status: 500 });
  }
}
