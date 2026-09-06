import { createSupabaseServerClient } from "@/lib/supabase/server";
import LeadsList from "@/components/team/LeadsList";

export default async function LeadsPage({ searchParams }: { searchParams: { archived?: string } }) {
  const supabase = createSupabaseServerClient();
  const showArchived = searchParams.archived === "1";

  // RLS on crm_leads restricts reps to their own assigned leads and lets the
  // owner see every lead — this query relies on that policy, not a manual
  // client-side filter, so access is enforced at the database level.
  let query = supabase
    .from("crm_leads")
    .select("id, business_name, website, phone, city, state, pipeline_stage, ai_overall_score, recommended_offer, archived, created_at")
    .order("created_at", { ascending: false });
  if (!showArchived) query = query.eq("archived", false);

  const { data: leads } = await query;

  return <LeadsList leads={leads ?? []} showArchived={showArchived} />;
}
