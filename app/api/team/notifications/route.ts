import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Follow-up due/overdue notifications aren't pre-seeded by a cron job (none
// exists yet) -- they're synced lazily here, once per due/overdue followup,
// so a rep never sees a duplicate and the notification only ever reflects a
// real open follow-up they actually own.
async function syncFollowupNotifications(supabase: ReturnType<typeof createSupabaseServerClient>, userId: string) {
  const now = new Date();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data: due } = await supabase
    .from("crm_followups")
    .select("id, lead_id, due_at, reason")
    .eq("rep_id", userId)
    .eq("status", "open")
    .lte("due_at", now.toISOString());

  if (!due || due.length === 0) return;

  const { data: existing } = await supabase.from("crm_notifications").select("related_followup_id").eq("user_id", userId).in(
    "related_followup_id",
    due.map((f) => f.id)
  );
  const alreadyNotified = new Set((existing ?? []).map((n) => n.related_followup_id));

  const leadIds = due.map((f) => f.lead_id);
  const { data: leads } = leadIds.length ? await supabase.from("crm_leads").select("id, business_name").in("id", leadIds) : { data: [] as any[] };
  const leadMap = Object.fromEntries((leads ?? []).map((l) => [l.id, l.business_name]));

  for (const f of due) {
    if (alreadyNotified.has(f.id)) continue;
    const overdue = new Date(f.due_at) < todayStart;
    await supabase.from("crm_notifications").insert({
      user_id: userId,
      type: overdue ? "follow_up_overdue" : "follow_up_due",
      title: overdue ? `Your follow-up with ${leadMap[f.lead_id] || "a lead"} is overdue.` : `Follow-up with ${leadMap[f.lead_id] || "a lead"} is due now.`,
      body: f.reason || null,
      related_lead_id: f.lead_id,
      related_followup_id: f.id,
      action_url: `/team/leads/${f.lead_id}`,
      action_label: overdue ? "Complete Follow-Up" : "Open Follow-Up",
    });
  }
}

export async function GET() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  await syncFollowupNotifications(supabase, user.id);

  const { data: notifications } = await supabase
    .from("crm_notifications")
    .select("*")
    .eq("is_dismissed", false)
    .order("created_at", { ascending: false })
    .limit(50);

  const unreadCount = (notifications ?? []).filter((n) => !n.is_read).length;
  return NextResponse.json({ notifications: notifications ?? [], unreadCount });
}
