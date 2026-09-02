import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminGuard";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

/**
 * Adds an audit finding to a project's most recent audit (creating one if
 * none exists yet). Body: { categoryName, severity, finding, recommendation }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status });

  const body = await req.json().catch(() => null);
  const { categoryName, severity, finding, recommendation } = body || {};
  if (!finding) {
    return NextResponse.json({ error: "finding is required." }, { status: 400 });
  }

  const service = createSupabaseServiceClient();

  let { data: audit } = await service
    .from("audits")
    .select("id")
    .eq("project_id", params.id)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!audit) {
    const { data: newAudit } = await service
      .from("audits")
      .insert({ project_id: params.id, audit_stage: "presence_audit" })
      .select("id")
      .single();
    audit = newAudit;
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
    audit_id: audit!.id,
    category_id: categoryId,
    severity: severity || "info",
    finding,
    recommendation: recommendation || null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
