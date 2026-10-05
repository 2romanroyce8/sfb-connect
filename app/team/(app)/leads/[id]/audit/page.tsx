import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import AuditView from "@/components/team/AuditView";

export default async function LeadAuditPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: lead } = await supabase
    .from("crm_leads")
    .select("id, business_name, website, category, city, state")
    .eq("id", params.id)
    .single();
  if (!lead) notFound();

  const { data: audit } = await supabase
    .from("crm_audits")
    .select("id, overall_score, identity_score, knowledge_score, authority_score, location_score, machine_readability_score, created_at")
    .eq("lead_id", params.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Audits are generated explicitly (Save-as-Lead, full re-research, or the
  // Regenerate button in AuditView) -- never as a side effect of merely
  // viewing this page. The previous auto-run-on-GET created audits nobody
  // asked for (e.g. junk leads got scored just by being opened).

  const { data: categories } = audit
    ? await supabase
        .from("crm_audit_categories")
        .select("category, score, reason, positive_evidence, negative_evidence, unknowns, recommended_fixes")
        .eq("audit_id", audit.id)
    : { data: [] as any[] };

  const { data: research } = await supabase.from("crm_research_results").select("identity_confidence").eq("converted_lead_id", params.id).order("updated_at", { ascending: false }).limit(1).maybeSingle();

  return <AuditView lead={lead as any} audit={audit as any} categories={(categories as any) || []} identityConfidence={research?.identity_confidence ?? null} />;
}
