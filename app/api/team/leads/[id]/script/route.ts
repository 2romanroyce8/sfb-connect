import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { generateScript, type ScriptVariant } from "@/lib/crm/script";
import type { CategoryResult } from "@/lib/crm/audit";
import type { Offer } from "@/lib/crm/opportunity";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: lead } = await supabase
    .from("crm_leads")
    .select("id, business_name, category")
    .eq("id", params.id)
    .single();
  if (!lead) return NextResponse.json({ error: "Lead not found or not accessible." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const variant: ScriptVariant = body.variant || "original";

  const { data: audit } = await supabase
    .from("crm_audits")
    .select("id")
    .eq("lead_id", params.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!audit) return NextResponse.json({ error: "Run the AI Presence Audit before generating a script." }, { status: 400 });

  const { data: categories } = await supabase
    .from("crm_audit_categories")
    .select("category, score, reason, positive_evidence, negative_evidence, unknowns, recommended_fixes")
    .eq("audit_id", audit.id);

  const { data: opportunity } = await supabase
    .from("crm_opportunities")
    .select("primary_offer, reasoning")
    .eq("lead_id", params.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sections = generateScript(
    lead.business_name,
    lead.category,
    (categories as CategoryResult[]) || [],
    { primary: (opportunity?.primary_offer as Offer) || "ai_presence", why: opportunity?.reasoning ? [opportunity.reasoning] : [] },
    variant
  );

  const service = createSupabaseServiceClient();
  const { data: script, error } = await service
    .from("crm_scripts")
    .insert({
      lead_id: params.id,
      variant_type: variant,
      created_by: user.id,
      opening: sections.opening,
      hook: sections.hook,
      observation: sections.observation,
      problem: sections.problem,
      why_it_matters: sections.why_it_matters,
      solution: sections.solution,
      discovery_question: sections.discovery_question,
      transition: sections.transition,
      booking_ask: sections.booking_ask,
      objections: sections.objections,
      close: sections.close,
    })
    .select("*")
    .single();

  if (error || !script) return NextResponse.json({ error: error?.message || "Could not save script." }, { status: 400 });

  await service.from("crm_activities").insert({
    lead_id: params.id,
    rep_id: user.id,
    activity_type: "script_generated",
    description: `Call script generated (${variant})`,
  });

  return NextResponse.json(script);
}
