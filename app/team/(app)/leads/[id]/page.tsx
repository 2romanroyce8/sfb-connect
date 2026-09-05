import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import LeadProfile from "@/components/team/LeadProfile";

export default async function LeadProfilePage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();

  // Every query below runs on the session-scoped client, so RLS decides
  // whether this rep is even allowed to see this lead — a rep hitting
  // another rep's lead ID gets an empty result, not a leaked record.
  const { data: lead } = await supabase
    .from("crm_leads")
    .select("id, business_name, website, phone, email, category, city, state, source_urls, pipeline_stage, recommended_offer")
    .eq("id", params.id)
    .single();

  if (!lead) notFound();

  const { data: evidence } = await supabase
    .from("crm_lead_evidence")
    .select("id, field_name, field_value, status, confidence, source_url, source_type")
    .eq("lead_id", params.id)
    .order("discovered_at", { ascending: false });

  const { data: audit } = await supabase
    .from("crm_audits")
    .select("overall_score, identity_score, knowledge_score, authority_score, location_score, machine_readability_score, summary, strengths, middle_points, weaknesses, unknowns")
    .eq("lead_id", params.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return <LeadProfile lead={lead as any} evidence={evidence ?? []} audit={audit as any} />;
}
