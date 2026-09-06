import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listUpcomingEvents } from "@/lib/crm/googleCalendar";
import CalendarWorkspace from "@/components/team/CalendarWorkspace";

export default async function CalendarPage({ searchParams }: { searchParams: { month?: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: caller } = await supabase.from("users").select("team_role, full_name, email").eq("id", user!.id).single();
  const isOwner = caller?.team_role === "owner";

  const monthParam = searchParams.month; // "YYYY-MM"
  const now = new Date();
  const year = monthParam ? parseInt(monthParam.split("-")[0]) : now.getFullYear();
  const monthIndex = monthParam ? parseInt(monthParam.split("-")[1]) - 1 : now.getMonth();
  const monthStart = new Date(year, monthIndex, 1);
  const gridStart = new Date(monthStart);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());
  const gridEnd = new Date(gridStart);
  gridEnd.setDate(gridEnd.getDate() + 42);

  const [{ data: meetings }, { data: followups }, { data: personalWork }] = await Promise.all([
    supabase
      .from("crm_meetings")
      .select("id, lead_id, rep_id, scheduled_at, ends_at, contact_name, contact_email, google_meet_url, status, timezone")
      .gte("scheduled_at", gridStart.toISOString())
      .lt("scheduled_at", gridEnd.toISOString()),
    supabase.from("crm_followups").select("id, lead_id, rep_id, due_at, reason, status").eq("status", "open").gte("due_at", gridStart.toISOString()).lt("due_at", gridEnd.toISOString()),
    supabase
      .from("crm_calendar_events")
      .select("*")
      .gte("start_at", gridStart.toISOString())
      .lt("start_at", gridEnd.toISOString())
      .eq("status", "confirmed"),
  ]);

  const leadIds = Array.from(new Set([...(meetings ?? []).map((m) => m.lead_id), ...(followups ?? []).map((f) => f.lead_id), ...(personalWork ?? []).map((e) => e.related_lead_id).filter(Boolean)]));
  const { data: leads } = leadIds.length ? await supabase.from("crm_leads").select("id, business_name, phone, email, pipeline_stage").in("id", leadIds as string[]) : { data: [] as any[] };
  const leadMap = Object.fromEntries((leads ?? []).map((l) => [l.id, l]));

  let googleEvents: any[] = [];
  try {
    const raw = await listUpcomingEvents(user!.id, gridStart.toISOString(), gridEnd.toISOString());
    const syncedIds = new Set((meetings ?? []).map((m: any) => m.calendar_event_id).filter(Boolean));
    googleEvents = raw.filter((e) => !syncedIds.has(e.id) && e.status !== "cancelled");
  } catch {
    // not connected / expired -- calendar still renders everything else
  }

  return (
    <CalendarWorkspace
      currentUser={{ id: user!.id, name: caller?.full_name || caller?.email || "You" }}
      isOwner={isOwner}
      year={year}
      monthIndex={monthIndex}
      meetings={(meetings ?? []) as any}
      followups={(followups ?? []) as any}
      personalWork={(personalWork ?? []) as any}
      googleEvents={googleEvents}
      leadMap={leadMap}
    />
  );
}
