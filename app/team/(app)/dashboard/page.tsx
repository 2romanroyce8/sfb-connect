import { createSupabaseServerClient } from "@/lib/supabase/server";
import OwnerDashboard from "@/components/team/OwnerDashboard";
import RepDashboard from "@/components/team/RepDashboard";

export default async function TeamDashboardPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("users")
    .select("id, full_name, email, team_role")
    .eq("id", user!.id)
    .single();

  const name = (profile?.full_name || profile?.email || "there").split(" ")[0];
  const isOwner = profile?.team_role === "owner";

  if (isOwner) {
    // Company-wide numbers — real queries against currently-empty tables.
    // No fake data: every count below reflects what's actually in the DB.
    const [{ count: totalLeads }, { count: qualifiedLeads }, { count: meetingsBooked }, { count: won }, { data: reps }] =
      await Promise.all([
        supabase.from("crm_leads").select("id", { count: "exact", head: true }),
        supabase.from("crm_leads").select("id", { count: "exact", head: true }).eq("pipeline_stage", "interested"),
        supabase.from("crm_meetings").select("id", { count: "exact", head: true }).eq("status", "booked"),
        supabase.from("crm_leads").select("id", { count: "exact", head: true }).eq("pipeline_stage", "won"),
        supabase.from("users").select("id, full_name, email").eq("team_role", "sales_rep"),
      ]);

    return (
      <OwnerDashboard
        name={name}
        totalLeads={totalLeads ?? 0}
        qualifiedLeads={qualifiedLeads ?? 0}
        meetingsBooked={meetingsBooked ?? 0}
        won={won ?? 0}
        reps={reps ?? []}
      />
    );
  }

  const [{ data: myLeads }, { data: followups }, { data: meetings }] = await Promise.all([
    supabase
      .from("crm_leads")
      .select("id, business_name, website, pipeline_stage, ai_overall_score, recommended_offer")
      .eq("assigned_rep", user!.id)
      .order("updated_at", { ascending: false })
      .limit(10),
    supabase
      .from("crm_followups")
      .select("id, lead_id, due_at, reason")
      .eq("rep_id", user!.id)
      .eq("status", "open")
      .order("due_at", { ascending: true })
      .limit(10),
    supabase
      .from("crm_meetings")
      .select("id, lead_id, scheduled_at, contact_name")
      .eq("rep_id", user!.id)
      .eq("status", "booked")
      .order("scheduled_at", { ascending: true })
      .limit(10),
  ]);

  return (
    <RepDashboard
      name={name}
      leads={myLeads ?? []}
      followups={followups ?? []}
      meetings={meetings ?? []}
    />
  );
}
