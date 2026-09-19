import { createSupabaseServiceClient } from "@/lib/supabase/server";

/**
 * Recommendations are derived FROM findings, never generated as generic
 * marketing advice, and never biased toward SFB revenue -- this module has
 * no awareness of expansion_opportunities/add-ons/credit packages at all.
 * The entitlement system decides included/credit/add-on/manual AFTER a
 * recommendation exists (Actions page, Phase 7) -- this stays upstream of
 * that entirely, per instruction.
 *
 * Mapping is a deterministic table keyed on the finding's key PREFIX (the
 * stable "kind" of finding), not free-text matching.
 */
const FINDING_KIND_TO_RECOMMENDATION: Record<string, (findingText: string) => { title: string; description: string }> = {
  not_detected: (findingText) => ({
    title: "Improve visibility for an undetected tracked query",
    description: `SFB found: "${findingText}". Consider strengthening structured business information and citations relevant to this query.`,
  }),
  platform_gap: (findingText) => ({
    title: "Close a cross-platform visibility gap",
    description: `SFB found: "${findingText}". The platforms where this business isn't appearing may be indexing different or less complete source information.`,
  }),
  competitor_present_gap: (findingText) => ({
    title: "Address a competitive visibility gap",
    description: `SFB found: "${findingText}". Review what distinguishes the competitor's presence for this exact query.`,
  }),
};

export async function applyRecommendationsForScan(businessId: string, projectId: string): Promise<void> {
  const supabase = createSupabaseServiceClient();

  // Only act on OPEN findings from this business tied to a real finding_key
  // (engine-generated), and only ones without an existing recommendation
  // yet (provenance-based dedup via finding_id).
  const { data: openFindings } = await supabase
    .from("audit_findings")
    .select("id, finding, finding_key")
    .eq("business_id", businessId)
    .eq("resolved", false)
    .not("finding_key", "is", null);

  if (!openFindings || openFindings.length === 0) return;

  const { data: existingRecs } = await supabase.from("recommendations").select("finding_id").eq("business_id", businessId).not("finding_id", "is", null);
  const hasRecommendation = new Set((existingRecs ?? []).map((r) => r.finding_id));

  for (const finding of openFindings) {
    if (hasRecommendation.has(finding.id)) continue; // provenance-based dedup -- one recommendation per finding

    const kind = (finding.finding_key as string).split(":")[0];
    const mapper = FINDING_KIND_TO_RECOMMENDATION[kind];
    if (!mapper) continue; // no mapping exists for this finding kind -- do not invent one

    const { title, description } = mapper(finding.finding);
    await supabase.from("recommendations").insert({
      business_id: businessId,
      project_id: projectId,
      finding_id: finding.id,
      title,
      description,
      priority: "medium",
      status: "pending",
      auto_generated: true,
    });
  }
}
