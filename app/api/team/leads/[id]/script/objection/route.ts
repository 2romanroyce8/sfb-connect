import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { generateObjectionResponse } from "@/lib/crm/script";
import type { CategoryResult } from "@/lib/crm/audit";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: lead } = await supabase.from("crm_leads").select("id, business_name").eq("id", params.id).single();
  if (!lead) return NextResponse.json({ error: "Lead not found or not accessible." }, { status: 404 });

  const body = await req.json();
  const objectionText: string = (body.objectionText || "").trim();
  const scriptId: string | undefined = body.scriptId;
  if (!objectionText) return NextResponse.json({ error: "Enter the objection the prospect raised." }, { status: 400 });

  const { data: audit } = await supabase
    .from("crm_audits")
    .select("id")
    .eq("lead_id", params.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: categories } = audit
    ? await supabase
        .from("crm_audit_categories")
        .select("category, score, reason, positive_evidence, negative_evidence, unknowns, recommended_fixes")
        .eq("audit_id", audit.id)
    : { data: [] as any[] };

  const response = generateObjectionResponse(objectionText, lead.business_name, (categories as CategoryResult[]) || []);

  const service = createSupabaseServiceClient();
  if (scriptId) {
    const { data: script } = await service.from("crm_scripts").select("objections").eq("id", scriptId).single();
    const objections = Array.isArray(script?.objections) ? script.objections : [];
    objections.push({ objection: objectionText, response });
    await service.from("crm_scripts").update({ objections }).eq("id", scriptId);
  }

  return NextResponse.json({ objection: objectionText, response });
}
