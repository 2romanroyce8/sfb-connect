import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { awardPointsForEvent, reversePointEvent } from "@/lib/team/competition/scoring";
import { ruleDueAt, ruleReason, demoIsNoClose, hasUpcomingOpen } from "@/lib/crm/followupRules";

const VALID = ["completed", "no_show", "cancelled", "rescheduled"];

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { outcome } = await req.json();
  if (!VALID.includes(outcome)) return NextResponse.json({ error: "Invalid outcome." }, { status: 400 });

  const { data: meeting } = await supabase.from("crm_meetings").select("id, lead_id, rep_id, status").eq("id", params.id).single();
  if (!meeting) return NextResponse.json({ error: "Meeting not found or not accessible." }, { status: 404 });

  const wasCompleted = meeting.status === "completed";
  await supabase.from("crm_meetings").update({ status: outcome, updated_at: new Date().toISOString() }).eq("id", params.id);

  // Attendance points require verified attendance -- award only on a real
  // transition INTO completed, and reverse (never delete) if attendance is
  // later corrected away from completed.
  if (outcome === "completed" && !wasCompleted) {
    await awardPointsForEvent({
      userId: meeting.rep_id,
      eventType: "demo_attended",
      sourceType: "crm_meetings",
      sourceId: meeting.id,
    });
  } else if (wasCompleted && outcome !== "completed") {
    await reversePointEvent({
      userId: meeting.rep_id,
      eventType: "demo_attended",
      sourceType: "crm_meetings",
      sourceId: meeting.id,
      reason: `Attendance corrected from completed to ${outcome} by ${user.id}`,
    });
  }

  if (outcome === "completed") {
    const { data: lead } = await supabase.from("crm_leads").select("pipeline_stage").eq("id", meeting.lead_id).single();
    await supabase.from("crm_leads").update({ pipeline_stage: "meeting_completed", updated_at: new Date().toISOString() }).eq("id", meeting.lead_id);
    await supabase.from("crm_pipeline_history").insert({ lead_id: meeting.lead_id, from_stage: lead?.pipeline_stage, to_stage: "meeting_completed", changed_by: user.id });

    // Outcome rule: a demo completed without a close (lead not won) gets a
    // follow-up in 3 days, unless one is already scheduled ahead.
    if (!wasCompleted && demoIsNoClose(lead?.pipeline_stage)) {
      try {
        const service = createSupabaseServiceClient();
        const nowDate = new Date();
        const { data: openRows } = await service.from("crm_followups").select("status, due_at").eq("lead_id", meeting.lead_id).eq("status", "open");
        if (!hasUpcomingOpen(openRows ?? [], nowDate)) {
          const dueAt = ruleDueAt("demo_no_close", nowDate)!.toISOString();
          const { data: fu } = await service
            .from("crm_followups")
            .insert({ lead_id: meeting.lead_id, rep_id: meeting.rep_id, created_by: user.id, followup_type: "CALL", due_at: dueAt, timezone: "America/New_York", creator_timezone: "America/New_York", reason: ruleReason("demo_no_close") })
            .select("id")
            .single();
          if (fu) {
            await service.from("crm_schedule_audit_log").insert({ entity_type: "followup", entity_id: fu.id, action: "created", new_scheduled_at: dueAt, business_timezone: null, employee_timezone: "America/New_York", actor_id: user.id, detail: "Auto-created by outcome rule: demo completed without close" });
          }
        }
      } catch (e) {
        console.error("[meeting outcome] auto follow-up failed:", e instanceof Error ? e.message : e);
      }
    }
  }

  await supabase.from("crm_activities").insert({
    lead_id: meeting.lead_id,
    rep_id: user.id,
    activity_type: "meeting_outcome",
    description: `Meeting marked ${outcome.replace(/_/g, " ")}`,
  });

  return NextResponse.json({ ok: true });
}
