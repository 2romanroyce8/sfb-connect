import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminGuard";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status });

  const body = await req.json().catch(() => null);
  const { title, description, priority, findingId } = body || {};
  if (!title) return NextResponse.json({ error: "title is required." }, { status: 400 });

  const service = createSupabaseServiceClient();

  const { data: project, error: projectErr } = await service
    .from("projects")
    .select("id, business_id")
    .eq("id", params.id)
    .maybeSingle();
  if (projectErr || !project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const { error } = await service.from("recommendations").insert({
    project_id: project.id,
    business_id: project.business_id,
    finding_id: findingId || null,
    title,
    description: description || null,
    priority: priority || "medium",
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status });

  const body = await req.json().catch(() => null);
  const { recommendationId, status } = body || {};
  if (!recommendationId || !status) {
    return NextResponse.json({ error: "recommendationId and status required." }, { status: 400 });
  }

  const service = createSupabaseServiceClient();
  const update: Record<string, unknown> = { status };
  if (status === "in_progress") update.started_at = new Date().toISOString();
  if (status === "done") update.completed_at = new Date().toISOString();

  const { error } = await service
    .from("recommendations")
    .update(update)
    .eq("id", recommendationId)
    .eq("project_id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
