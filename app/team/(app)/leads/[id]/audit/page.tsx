import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { computeAndSaveAudit } from "@/lib/crm/audit";
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

  let { data: audit } = await supabase
    .from("crm_audits")
    .select("id, overall_score, identity_score, knowledge_score, authority_score, location_score, machine_readability_score, created_at")
    .eq("lead_id", params.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // First visit to this tab with research already on file — auto-run the
  // deterministic scoring pass once so the rep isn't staring at an empty
  // page. This does not re-fetch any source; it only reads stored evidence.
  if (!audit) {
    const { data: evidenceCheck } = await supabase
      .from("crm_lead_evidence")
      .select("id")
      .eq("lead_id", params.id)
      .limit(1);
    if (evidenceCheck && evidenceCheck.length > 0) {
      try {
        await computeAndSaveAudit(params.id, user!.id);
        const { data: freshAudit } = await supabase
          .from("crm_audits")
          .select("id, overall_score, identity_score, knowledge_score, authority_score, location_score, machine_readability_score, created_at")
          .eq("lead_id", params.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        audit = freshAudit;
      } catch {
        // fall through — the page will show the "no research yet" state
      }
    }
  }

  const { data: categories } = audit
    ? await supabase
        .from("crm_audit_categories")
        .select("category, score, reason, positive_evidence, negative_evidence, unknowns, recommended_fixes")
        .eq("audit_id", audit.id)
    : { data: [] as any[] };

  return <AuditView lead={lead as any} audit={audit as any} categories={(categories as any) || []} />;
}
