import type { SupabaseClient } from "@supabase/supabase-js";

export type NotificationType =
  | "lead_assigned"
  | "research_complete"
  | "follow_up_due"
  | "follow_up_overdue"
  | "meeting_booked"
  | "meeting_soon"
  | "meeting_rescheduled"
  | "meeting_cancelled"
  | "owner_task_assigned"
  | "calendar_mention"
  | "script_ready"
  | "quiz_required"
  | "sop_required"
  | "booking_sync_failed"
  | "system";

// Every call here is a real CRM event that already happened -- reassigning a
// lead, booking/rescheduling/cancelling a meeting, a Google sync failure.
// Nothing calls this speculatively. Uses the service client because the
// recipient is very often someone other than the person performing the
// action (e.g. the owner gets notified when a rep books a meeting).
export async function notify(
  service: SupabaseClient,
  params: {
    userId: string;
    type: NotificationType;
    title: string;
    body?: string;
    relatedLeadId?: string;
    relatedMeetingId?: string;
    relatedFollowupId?: string;
    actionUrl?: string;
    actionLabel?: string;
    secondaryActionUrl?: string;
    secondaryActionLabel?: string;
  }
) {
  await service.from("crm_notifications").insert({
    user_id: params.userId,
    type: params.type,
    title: params.title,
    body: params.body || null,
    related_lead_id: params.relatedLeadId || null,
    related_meeting_id: params.relatedMeetingId || null,
    related_followup_id: params.relatedFollowupId || null,
    action_url: params.actionUrl || null,
    action_label: params.actionLabel || null,
    secondary_action_url: params.secondaryActionUrl || null,
    secondary_action_label: params.secondaryActionLabel || null,
  });
}

export async function getOwnerIds(service: SupabaseClient): Promise<string[]> {
  const { data } = await service.from("users").select("id").eq("team_role", "owner");
  return (data ?? []).map((r) => r.id);
}
