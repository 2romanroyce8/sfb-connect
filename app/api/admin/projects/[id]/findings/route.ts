import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminGuard";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

/**
 * Adds a finding directly to a scan run (project). The old `audits`
 * workflow-stage intermediary table has been retired -- findings now
 * attach straight to project_id + business_id (business_id resolved
 * server-side, never client-supplied).
 * Body: { categoryName, severity, finding, recommendation, platform, queryText, evidenceText }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status });

  const body = await req.json().catch(() => null);
  const { categoryName, severity, finding, recommendation, platform, queryText, evidenceText } = body || {};
  if (!finding) {
    return NextResponse.json({ error: "finding is required." }, { status: 400 });
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

  let categoryId: string | null = null;
  if (categoryName) {
    const { data: category } = await service
      .from("audit_categories")
      .select("id")
      .eq("name", categoryName)
      .maybeSingle();
    categoryId = category?.id ?? null;
  }

  const { error } = await service.from("audit_findings").insert({
    project_id: project.id,
    business_id: project.business_id,
    category_id: categoryId,
    severity: severity || "info",
    finding,
    recommendation: recommendation || null,
    platform: platform || null,
    query_text: queryText || null,
    evidence_text: evidenceText || null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
