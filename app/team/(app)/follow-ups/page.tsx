import { createSupabaseServerClient } from "@/lib/supabase/server";
import FollowUpStack from "@/components/team/FollowUpStack";

export default async function FollowUpsPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: caller } = await supabase.from("users").select("team_role, home_timezone").eq("id", user!.id).single();
  const isOwner = caller?.team_role === "owner";
  // Never fall back silently forever -- this default only covers a user
  // who hasn't visited Settings yet; the moment they set a real value
  // there, every scheduling surface uses it.
  const employeeTimezone = caller?.home_timezone || "America/New_York";

  const { data: followups } = await supabase
    .from("crm_followups")
    .select("*")
    .order("due_at", { ascending: true });

  const list = followups ?? [];
  const leadIds = Array.from(new Set(list.map((f) => f.lead_id)));
  const callIds = Array.from(new Set(list.map((f) => f.related_call_id).filter(Boolean)));
  const meetingIds = Array.from(new Set(list.map((f) => f.related_meeting_id).filter(Boolean)));
  const repIds = Array.from(new Set(list.map((f) => f.rep_id).filter(Boolean)));

  const [{ data: leads }, { data: relatedCalls }, { data: recentCallsByLead }, { data: meetings }, { data: reps }] = await Promise.all([
    leadIds.length ? supabase.from("crm_leads").select("id, business_name, phone, email, category, owner_name, city, state").in("id", leadIds) : Promise.resolve({ data: [] as any[] }),
    callIds.length ? supabase.from("crm_calls").select("id, outcome, outcome_reason, notes, ended_at").in("id", callIds) : Promise.resolve({ data: [] as any[] }),
    // Fallback context source when a follow-up has no related_call_id: the
    // lead's own most recent completed call, newest first per lead.
    leadIds.length ? supabase.from("crm_calls").select("id, lead_id, outcome, outcome_reason, notes, ended_at").in("lead_id", leadIds).not("ended_at", "is", null).order("ended_at", { ascending: false }) : Promise.resolve({ data: [] as any[] }),
    meetingIds.length ? supabase.from("crm_meetings").select("id, scheduled_at, google_meet_url, contact_name, status").in("id", meetingIds) : Promise.resolve({ data: [] as any[] }),
    isOwner && repIds.length ? supabase.from("users").select("id, full_name, email, home_timezone").in("id", repIds) : Promise.resolve({ data: [] as any[] }),
  ]);

  const { data: allReps } = isOwner ? await supabase.from("users").select("id, full_name, email, home_timezone").not("team_role", "is", null).eq("team_status", "active") : { data: [] as any[] };

  const leadMap = Object.fromEntries((leads ?? []).map((l) => [l.id, l]));
  const callMap = Object.fromEntries((relatedCalls ?? []).map((c) => [c.id, c]));
  const meetingMap = Object.fromEntries((meetings ?? []).map((m) => [m.id, m]));
  const repMap = Object.fromEntries((reps ?? []).map((r) => [r.id, r.full_name || r.email]));
  // Assigned rep's OWN home timezone -- used so an owner viewing Braylen's
  // follow-up sees BRAYLEN's local time as primary, not their own (spec:
  // "do not make Roman assume displayed time belongs to him").
  const repTimezoneMap = Object.fromEntries((reps ?? []).map((r) => [r.id, r.home_timezone || "America/New_York"]));

  const mostRecentCallByLead: Record<string, any> = {};
  for (const c of recentCallsByLead ?? []) {
    if (!mostRecentCallByLead[c.lead_id]) mostRecentCallByLead[c.lead_id] = c;
  }

  return (
    <FollowUpStack
      followups={list}
      leadMap={leadMap}
      callMap={callMap}
      mostRecentCallByLead={mostRecentCallByLead}
      meetingMap={meetingMap}
      repMap={repMap}
      isOwner={isOwner}
      currentUserId={user!.id}
      allReps={(allReps ?? []).map((r) => ({ id: r.id, label: r.full_name || r.email, homeTimezone: r.home_timezone || "America/New_York" }))}
      employeeTimezone={employeeTimezone}
      repTimezoneMap={repTimezoneMap}
    />
  );
}
