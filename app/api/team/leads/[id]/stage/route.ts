import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const VALID_STAGES = [
  "new",
  "researching",
  "ready_to_call",
  "contacted",
  "interested",
  "follow_up",
  "nurture",
  "meeting_booked",
  "proposal",
  "won",
  "lost",
];

// Runs entirely on the session-scoped client on purpose: crm_leads' own RLS
// (owner: all, rep: only assigned_rep = auth.uid()) decides whether this
// write is even allowed. A rep dragging another rep's card never reaches
// the database with permission to move it — no application-level check
// could be as reliable as just relying on the policy that's already there.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { stage } = await req.json();
  if (!VALID_STAGES.includes(stage)) return NextResponse.json({ error: "Invalid stage." }, { status: 400 });

  const { data: lead, error: readError } = await supabase.from("crm_leads").select("pipeline_stage").eq("id", params.id).single();
  if (readError || !lead) return NextResponse.json({ error: "Lead not found or not accessible." }, { status: 404 });
  if (lead.pipeline_stage === stage) return NextResponse.json({ ok: true });

  const { error } = await supabase
    .from("crm_leads")
    .update({ pipeline_stage: stage, updated_at: new Date().toISOString() })
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await supabase.from("crm_pipeline_history").insert({ lead_id: params.id, from_stage: lead.pipeline_stage, to_stage: stage, changed_by: user.id });
  await supabase.from("crm_activities").insert({
    lead_id: params.id,
    rep_id: user.id,
    activity_type: "pipeline_changed",
    description: `Moved from ${lead.pipeline_stage.replace(/_/g, " ")} to ${stage.replace(/_/g, " ")}`,
  });

  return NextResponse.json({ ok: true });
}
