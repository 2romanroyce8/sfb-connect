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
    .select(
      "id, business_name, website, phone, email, category, description, services, owner_name, city, state, source_urls, pipeline_stage, recommended_offer, research_completeness, research_completeness_breakdown, last_researched_at"
    )
    .eq("id", params.id)
    .single();
  if (!lead) notFound();

  const [{ data: contactMethods }, { data: locations }, { data: socialProfiles }, { data: sourceChecks }, { data: audit }] = await Promise.all([
    supabase.from("crm_lead_contact_methods").select("id, type, value, status, confidence, source_url, manual_value, edited_at").eq("lead_id", params.id),
    supabase.from("crm_lead_locations").select("id, name, address, city, state, postal_code, location_type, status, confidence, source_url, manual_value, edited_at").eq("lead_id", params.id),
    supabase.from("crm_lead_social_profiles").select("id, platform, handle, url, display_name, status, confidence, source_url, manual_value, edited_at").eq("lead_id", params.id),
    supabase.from("crm_lead_source_checks").select("source_url, source_type, reachable, reason, checked_at").eq("lead_id", params.id).order("checked_at", { ascending: false }),
    supabase
      .from("crm_audits")
      .select("overall_score, identity_score, knowledge_score, authority_score, location_score, machine_readability_score, summary, strengths, middle_points, weaknesses, unknowns")
      .eq("lead_id", params.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return (
    <LeadProfile
      lead={lead as any}
      contactMethods={contactMethods ?? []}
      locations={locations ?? []}
      socialProfiles={socialProfiles ?? []}
      sourceChecks={sourceChecks ?? []}
      audit={audit as any}
    />
  );
}
