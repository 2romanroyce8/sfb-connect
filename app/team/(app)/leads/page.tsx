import { createSupabaseServerClient } from "@/lib/supabase/server";
import LeadsList from "@/components/team/LeadsList";

export default async function LeadsPage() {
  const supabase = createSupabaseServerClient();

  // RLS on crm_leads restricts reps to their own assigned leads and lets the
  // owner see every lead — this query relies on that policy, not a manual
  // client-side filter, so access is enforced at the database level.
  const { data: leads } = await supabase
    .from("crm_leads")
    .select("id, business_name, website, phone, city, state, pipeline_stage, ai_overall_score, recommended_offer, created_at")
    .order("created_at", { ascending: false });

  return <LeadsList leads={leads ?? []} />;
}
