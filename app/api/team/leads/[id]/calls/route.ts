import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";

// Starts a real call session. No telephony provider is connected, so this
// is a "Device Call": the CRM tracks start/end/duration/outcome and the rep
// dials from their own phone/softphone via the tel: link the client opens.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: lead } = await supabase.from("crm_leads").select("id, phone, pipeline_stage").eq("id", params.id).single();
  if (!lead) return NextResponse.json({ error: "Lead not found or not accessible." }, { status: 404 });

  const service = createSupabaseServiceClient();
  const { data: call, error } = await service
    .from("crm_calls")
    .insert({ lead_id: params.id, rep_id: user.id, started_at: new Date().toISOString(), call_type: "device_call" })
    .select("*")
    .single();
  if (error || !call) return NextResponse.json({ error: error?.message || "Could not start call." }, { status: 400 });

  if (lead.pipeline_stage === "new" || lead.pipeline_stage === "researching" || lead.pipeline_stage === "ready_to_call") {
    await service.from("crm_leads").update({ pipeline_stage: "contacted", updated_at: new Date().toISOString() }).eq("id", params.id);
    await service.from("crm_pipeline_history").insert({ lead_id: params.id, from_stage: lead.pipeline_stage, to_stage: "contacted", changed_by: user.id });
  }

  await service.from("crm_activities").insert({
    lead_id: params.id,
    rep_id: user.id,
    activity_type: "call_started",
    description: "Call started",
  });

  return NextResponse.json(call);
}
