import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { evaluateCompleteness } from "@/lib/research/CompletenessEvaluator";
import { persistGraphToLead } from "@/lib/crm/persistGraph";
import { computeAndSaveAudit } from "@/lib/crm/audit";
import type { BusinessGraph } from "@/lib/research/types";

// The only place a crm_leads row gets created from research. Everything the
// pipeline found is written in one shot from the graph that's already been
// reviewed (and possibly edited) on the Research Results screen.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: result } = await supabase.from("crm_research_results").select("*").eq("id", params.id).single();
  if (!result) return NextResponse.json({ error: "Research result not found or not accessible." }, { status: 404 });
  if (result.status === "saved") return NextResponse.json({ error: "This research has already been saved as a lead." }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const assignedRep: string | undefined = body.assignedRep;

  const service = createSupabaseServiceClient();
  const graph = result.graph_json as BusinessGraph;

  const { data: lead, error: leadError } = await service
    .from("crm_leads")
    .insert({
      source_urls: result.source_urls,
      business_name: result.business_name,
      website: result.website,
      phone: result.phone,
      email: result.email,
      category: result.category,
      description: result.description,
      services: result.services,
      owner_name: result.owner_name,
      city: result.city,
      state: result.state,
      service_area: graph.locations?.filter((l) => l.locationType === "service_area").map((l) => l.city).filter(Boolean).join(", ") || null,
      research_completeness: result.research_completeness,
      research_completeness_breakdown: result.research_completeness_breakdown,
      last_researched_at: result.created_at,
      pipeline_stage: result.phone || result.website ? "ready_to_call" : "researching",
      assigned_rep: assignedRep || null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (leadError || !lead) return NextResponse.json({ error: leadError?.message || "Could not create lead." }, { status: 400 });

  await persistGraphToLead(lead.id, graph, service);

  await service.from("crm_research_results").update({ status: "saved", converted_lead_id: lead.id, updated_at: new Date().toISOString() }).eq("id", params.id);

  await service.from("crm_activities").insert({ lead_id: lead.id, rep_id: user.id, activity_type: "lead_imported", description: "Lead saved from research results" });

  const auditResult = await computeAndSaveAudit(lead.id, user.id);

  return NextResponse.json({ leadId: lead.id, overallScore: auditResult.overall, offer: auditResult.opportunity.primary });
}
