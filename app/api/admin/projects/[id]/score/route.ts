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
  const {
    overall_score,
    identity_score,
    knowledge_score,
    authority_score,
    location_score,
    machine_readability_score,
  } = body || {};

  if (typeof overall_score !== "number") {
    return NextResponse.json({ error: "overall_score is required." }, { status: 400 });
  }

  const service = createSupabaseServiceClient();

  const { data: project, error: projectErr } = await service
    .from("projects")
    .select("id, business_id")
    .eq("id", params.id)
    .maybeSingle();
  if (projectErr || !project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const { error } = await service.from("presence_scores").insert({
    project_id: project.id,
    business_id: project.business_id,
    overall_score,
    identity_score,
    knowledge_score,
    authority_score,
    location_score,
    machine_readability_score,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
