import { createSupabaseServerClient } from "@/lib/supabase/server";
import ActivityFeed from "@/components/team/ActivityFeed";

export default async function ActivityPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: caller } = await supabase.from("users").select("team_role").eq("id", user!.id).single();
  const isOwner = caller?.team_role === "owner";

  const { data: activities } = await supabase
    .from("crm_activities")
    .select("id, lead_id, rep_id, activity_type, description, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const leadIds = Array.from(new Set((activities ?? []).map((a) => a.lead_id).filter(Boolean)));
  const repIds = Array.from(new Set((activities ?? []).map((a) => a.rep_id).filter(Boolean)));
  const [{ data: leads }, { data: reps }] = await Promise.all([
    leadIds.length ? supabase.from("crm_leads").select("id, business_name").in("id", leadIds) : Promise.resolve({ data: [] as any[] }),
    isOwner && repIds.length ? supabase.from("users").select("id, full_name, email").in("id", repIds) : Promise.resolve({ data: [] as any[] }),
  ]);
  const leadMap = Object.fromEntries((leads ?? []).map((l) => [l.id, l.business_name]));
  const repMap = Object.fromEntries((reps ?? []).map((r) => [r.id, r.full_name || r.email]));

  return <ActivityFeed activities={activities ?? []} leadMap={leadMap} repMap={repMap} isOwner={isOwner} />;
}
