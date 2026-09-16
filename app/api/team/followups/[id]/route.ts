import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// RLS on crm_followups (rep_id = auth.uid() or owner) governs this directly
// on the session client — no service-role escape hatch needed here.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json();
  const update: Record<string, unknown> = {};
  if (body.status) {
    update.status = body.status;
    update.completed_at = body.status === "completed" ? new Date().toISOString() : null;
  }
  const isReschedule = !!body.dueAt;
  if (body.dueAt) update.due_at = body.dueAt;
  if (body.businessTimezone) update.business_timezone = body.businessTimezone;
  if (body.creatorTimezone) update.creator_timezone = body.creatorTimezone;
  if (body.inputTimezone) update.input_timezone = body.inputTimezone;
  if (body.inputLocalDatetime) update.input_local_datetime = body.inputLocalDatetime;
  if (body.reason !== undefined) update.reason = body.reason;

  if (Object.keys(update).length === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  // Read the OLD scheduled time first (for the audit log) before applying
  // the update — a reschedule must record what it actually changed FROM.
  const { data: before } = isReschedule ? await supabase.from("crm_followups").select("due_at").eq("id", params.id).single() : { data: null };

  const { data: followup, error } = await supabase.from("crm_followups").update(update).eq("id", params.id).select("lead_id, due_at, business_timezone").single();
  if (error || !followup) return NextResponse.json({ error: error?.message || "Follow-up not found or not accessible." }, { status: 400 });

  await supabase.from("crm_activities").insert({
    lead_id: followup.lead_id,
    rep_id: user.id,
    activity_type: "follow_up_updated",
    description: body.status ? `Follow-up marked ${body.status}` : "Follow-up rescheduled",
  });

  if (isReschedule) {
    await supabase.from("crm_schedule_audit_log").insert({
      entity_type: "followup",
      entity_id: params.id,
      action: "rescheduled",
      old_scheduled_at: before?.due_at ?? null,
      new_scheduled_at: followup.due_at,
      business_timezone: followup.business_timezone,
      employee_timezone: body.creatorTimezone || null,
      actor_id: user.id,
    });
  }

  return NextResponse.json({ ok: true });
}
