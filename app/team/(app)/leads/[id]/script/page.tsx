import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateBusinessSummary } from "@/lib/crm/summary";
import ScriptWorkspace from "@/components/team/ScriptWorkspace";

export default async function LeadScriptPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();

  const { data: lead } = await supabase
    .from("crm_leads")
    .select("id, business_name, website, phone, category, city, recommended_offer")
    .eq("id", params.id)
    .single();
  if (!lead) notFound();

  const { data: audit } = await supabase
    .from("crm_audits")
    .select("id, overall_score")
    .eq("lead_id", params.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: categories } = audit
    ? await supabase
        .from("crm_audit_categories")
        .select("category, score, reason, positive_evidence, negative_evidence, unknowns, recommended_fixes")
        .eq("audit_id", audit.id)
    : { data: [] as any[] };

  const { data: opportunity } = await supabase
    .from("crm_opportunities")
    .select("primary_offer, secondary_offer, confidence, reasoning")
    .eq("lead_id", params.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: script } = await supabase
    .from("crm_scripts")
    .select("*")
    .eq("lead_id", params.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const summary = categories && categories.length > 0 ? generateBusinessSummary(lead.business_name, lead.category, lead.city, categories as any) : null;

  return (
    <ScriptWorkspace
      lead={lead as any}
      hasAudit={!!audit}
      summary={summary}
      opportunity={(opportunity as any) || null}
      script={(script as any) || null}
    />
  );
}
