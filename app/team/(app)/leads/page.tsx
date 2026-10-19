import { createSupabaseServerClient } from "@/lib/supabase/server";
import LeadsList from "@/components/team/LeadsList";

const BASE_COLUMNS = "id, business_name, website, phone, city, state, pipeline_stage, ai_overall_score, recommended_offer, archived, created_at";

export default async function LeadsPage({ searchParams }: { searchParams: { archived?: string; tag?: string } }) {
  const supabase = createSupabaseServerClient();
  const showArchived = searchParams.archived === "1";
  const activeTag = searchParams.tag ? String(searchParams.tag).trim().toLowerCase() : null;

  // RLS on crm_leads restricts reps to their own assigned leads and lets the
  // owner see every lead — this query relies on that policy, not a manual
  // client-side filter, so access is enforced at the database level.
  const build = (columns: string, withTagFilter: boolean) => {
    let q = supabase.from("crm_leads").select(columns).order("created_at", { ascending: false });
    if (!showArchived) q = q.eq("archived", false);
    if (withTagFilter && activeTag) q = q.contains("tags", [activeTag]);
    return q;
  };

  // tags come from the CSV importer (crm_leads.tags). If that column is ever
  // missing (migration not applied), fall back so the Leads page still loads.
  let { data: leads, error } = await build(`${BASE_COLUMNS}, tags`, true);
  if (error) {
    console.error("[leads] tags query failed, falling back without tags:", error.message);
    ({ data: leads } = await build(BASE_COLUMNS, false));
  }

  return <LeadsList leads={(leads as any[]) ?? []} showArchived={showArchived} activeTag={activeTag} />;
}
