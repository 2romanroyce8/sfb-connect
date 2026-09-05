import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const VALID = ["completed", "no_show", "cancelled", "rescheduled"];

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { outcome } = await req.json();
  if (!VALID.includes(outcome)) return NextResponse.json({ error: "Invalid outcome." }, { status: 400 });

  const { data: meeting } = await supabase.from("crm_meetings").select("id, lead_id").eq("id", params.id).single();
  if (!meeting) return NextResponse.json({ error: "Meeting not found or not accessible." }, { status: 404 });

  await supabase.from("crm_meetings").update({ status: outcome, updated_at: new Date().toISOString() }).eq("id", params.id);

  if (outcome === "completed") {
    const { data: lead } = await supabase.from("crm_leads").select("pipeline_stage").eq("id", meeting.lead_id).single();
    await supabase.from("crm_leads").update({ pipeline_stage: "meeting_completed", updated_at: new Date().toISOString() }).eq("id", meeting.lead_id);
    await supabase.from("crm_pipeline_history").insert({ lead_id: meeting.lead_id, from_stage: lead?.pipeline_stage, to_stage: "meeting_completed", changed_by: user.id });
  }

  await supabase.from("crm_activities").insert({
    lead_id: meeting.lead_id,
    rep_id: user.id,
    activity_type: "meeting_outcome",
    description: `Meeting marked ${outcome.replace(/_/g, " ")}`,
  });

  return NextResponse.json({ ok: true });
}
