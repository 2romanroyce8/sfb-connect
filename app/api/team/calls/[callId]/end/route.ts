import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";

const OUTCOME_STAGE: Record<string, string | null> = {
  booked_meeting: "meeting_booked",
  interested: "interested",
  call_back_later: "follow_up",
  no_answer: null,
  voicemail: null,
  not_interested: "lost",
  wrong_number: null,
  hung_up: null,
  bad_lead: "lost",
  sale_closed: "won",
  other: null,
};

const VALID_OUTCOMES = Object.keys(OUTCOME_STAGE);

export async function POST(req: NextRequest, { params }: { params: { callId: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // RLS on crm_calls restricts this select to the rep's own calls (or the
  // owner) — a rep can't end/annotate another rep's call by guessing an id.
  const { data: call } = await supabase.from("crm_calls").select("id, lead_id, started_at, rep_id").eq("id", params.callId).single();
  if (!call) return NextResponse.json({ error: "Call not found or not accessible." }, { status: 404 });

  const body = await req.json();
  const outcome: string = body.outcome;
  const outcomeReason: string | undefined = body.outcomeReason;
  const followup: { dueAt: string; reason?: string } | undefined = body.followup;
  const meeting: { scheduledAt: string; contactName?: string; contactEmail?: string; contactPhone?: string } | undefined = body.meeting;

  if (!VALID_OUTCOMES.includes(outcome)) {
    return NextResponse.json({ error: "Invalid outcome." }, { status: 400 });
  }

  const service = createSupabaseServiceClient();
  const endedAt = new Date();
  const durationSeconds = Math.max(0, Math.round((endedAt.getTime() - new Date(call.started_at).getTime()) / 1000));

  await service
    .from("crm_calls")
    .update({ ended_at: endedAt.toISOString(), duration_seconds: durationSeconds, outcome, outcome_reason: outcomeReason || null })
    .eq("id", call.id);

  const newStage = OUTCOME_STAGE[outcome];
  const { data: lead } = await service.from("crm_leads").select("pipeline_stage").eq("id", call.lead_id).single();
  if (newStage && lead && lead.pipeline_stage !== newStage) {
    await service.from("crm_leads").update({ pipeline_stage: newStage, updated_at: new Date().toISOString() }).eq("id", call.lead_id);
    await service.from("crm_pipeline_history").insert({ lead_id: call.lead_id, from_stage: lead.pipeline_stage, to_stage: newStage, changed_by: user.id });
  }

  if (outcome === "wrong_number") {
    await service.from("crm_lead_evidence").insert({
      lead_id: call.lead_id,
      field_name: "phone",
      field_value: null,
      status: "conflict",
      confidence: 0,
      source_url: null,
      source_type: "call",
      research_pass: 9,
      evidence_excerpt: "Rep confirmed this number is incorrect during a call.",
    });
  }

  if (outcome === "call_back_later" && followup?.dueAt) {
    await service.from("crm_followups").insert({
      lead_id: call.lead_id,
      rep_id: user.id,
      due_at: followup.dueAt,
      reason: followup.reason || "Call back requested",
    });
  } else if ((outcome === "interested" || outcome === "no_answer" || outcome === "voicemail") && followup?.dueAt) {
    await service.from("crm_followups").insert({
      lead_id: call.lead_id,
      rep_id: user.id,
      due_at: followup.dueAt,
      reason: followup.reason || `Follow up after ${outcome.replace(/_/g, " ")}`,
    });
  }

  if (outcome === "booked_meeting" && meeting?.scheduledAt) {
    await service.from("crm_meetings").insert({
      lead_id: call.lead_id,
      rep_id: user.id,
      call_id: call.id,
      scheduled_at: meeting.scheduledAt,
      contact_name: meeting.contactName || null,
      contact_email: meeting.contactEmail || null,
      contact_phone: meeting.contactPhone || null,
      // No calendar/video provider is connected yet — this is a real
      // scheduled-meeting record, but calendar_event_id/google_meet_url stay
      // null until the booking-automation phase wires up Google Calendar.
      status: "booked",
    });
  }

  await service.from("crm_activities").insert({
    lead_id: call.lead_id,
    rep_id: user.id,
    activity_type: "call_ended",
    description: `Call ended — outcome: ${outcome.replace(/_/g, " ")}`,
  });

  return NextResponse.json({ ok: true, durationSeconds, newStage });
}
