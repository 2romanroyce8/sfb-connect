import { createSupabaseServerClient } from "@/lib/supabase/server";
import MeetingsList from "@/components/team/MeetingsList";

export default async function MeetingsPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: caller } = await supabase.from("users").select("team_role").eq("id", user!.id).single();
  const isOwner = caller?.team_role === "owner";

  const { data: meetings } = await supabase
    .from("crm_meetings")
    .select("id, lead_id, rep_id, scheduled_at, ends_at, contact_name, contact_email, google_meet_url, status")
    .order("scheduled_at", { ascending: true });

  const leadIds = Array.from(new Set((meetings ?? []).map((m) => m.lead_id)));
  const repIds = Array.from(new Set((meetings ?? []).map((m) => m.rep_id)));
  const [{ data: leads }, { data: reps }] = await Promise.all([
    leadIds.length ? supabase.from("crm_leads").select("id, business_name, phone").in("id", leadIds) : Promise.resolve({ data: [] as any[] }),
    isOwner && repIds.length ? supabase.from("users").select("id, full_name, email").in("id", repIds) : Promise.resolve({ data: [] as any[] }),
  ]);
  const leadMap = Object.fromEntries((leads ?? []).map((l) => [l.id, l]));
  const repMap = Object.fromEntries((reps ?? []).map((r) => [r.id, r.full_name || r.email]));

  return <MeetingsList meetings={meetings ?? []} leadMap={leadMap} repMap={repMap} isOwner={isOwner} />;
}
