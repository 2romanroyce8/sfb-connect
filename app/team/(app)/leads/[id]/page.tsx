import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import LeadProfile from "@/components/team/LeadProfile";

export default async function LeadProfilePage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Every query below runs on the session-scoped client, so RLS decides
  // whether this rep is even allowed to see this lead — a rep hitting
  // another rep's lead ID gets an empty result, not a leaked record.
  const LEAD_COLUMNS =
    "id, business_name, website, phone, email, category, description, services, owner_name, city, state, source_urls, pipeline_stage, recommended_offer, research_completeness, research_completeness_breakdown, last_researched_at, archived, assigned_rep";
  // tags come from the CSV importer (crm_leads.tags). If that column is ever
  // missing, retry without it so the profile still opens.
  let { data: lead, error: leadError } = await supabase.from("crm_leads").select(`${LEAD_COLUMNS}, tags`).eq("id", params.id).maybeSingle();
  if (leadError) {
    console.error("[lead profile] tags query failed, falling back without tags:", leadError.message);
    ({ data: lead } = await supabase.from("crm_leads").select(LEAD_COLUMNS).eq("id", params.id).maybeSingle());
  }
  if (!lead) notFound();

  const { data: caller } = await supabase.from("users").select("team_role, home_timezone").eq("id", user!.id).single();
  const isOwner = caller?.team_role === "owner";
  const employeeTimezone = caller?.home_timezone || "America/New_York";

  const [{ data: contactMethods }, { data: locations }, { data: socialProfiles }, { data: sourceChecks }, { data: audit }, { data: reps }] = await Promise.all([
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
    isOwner ? supabase.from("users").select("id, full_name, email").not("team_role", "is", null).eq("team_status", "active") : Promise.resolve({ data: [] as any[] }),
  ]);

  return (
    <LeadProfile
      lead={lead as any}
      contactMethods={contactMethods ?? []}
      locations={locations ?? []}
      socialProfiles={socialProfiles ?? []}
      sourceChecks={sourceChecks ?? []}
      audit={audit as any}
      isOwner={isOwner}
      reps={(reps ?? []).map((r) => ({ id: r.id, label: r.full_name || r.email }))}
      employeeTimezone={employeeTimezone}
    />
  );
}
