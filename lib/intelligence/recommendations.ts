import { createSupabaseServiceClient } from "@/lib/supabase/server";

/**
 * Recommendations derive strictly FROM findings (finding_id provenance).
 * This module has zero awareness of expansion_opportunities / add-ons /
 * credit packages -- it never upsells. The Action Catalog connection is a
 * SEPARATE, owner-editable, deterministic table
 * (recommendation_action_mappings): finding_kind + recommendation_type ->
 * action_catalog row. The entitlement engine decides included / credits /
 * managed at display time (Actions page). Nothing here executes or
 * consumes credits; a mapped action only ever reaches READY FOR APPROVAL.
 */
const FINDING_KIND_TO_RECOMMENDATION: Record<string, { type: string; build: (findingText: string) => { title: string; description: string } }> = {
  not_detected: {
    type: "improve_query_visibility",
    build: (f) => ({ title: "Improve visibility for an undetected tracked query", description: `SFB found: "${f}". Strengthen structured business information and citations relevant to this query.` }),
  },
  platform_gap: {
    type: "close_platform_gap",
    build: (f) => ({ title: "Close a cross-platform visibility gap", description: `SFB found: "${f}". Platforms where this business isn't appearing may index different or less complete source information.` }),
  },
  competitor_present_gap: {
    type: "address_competitive_gap",
    build: (f) => ({ title: "Address a competitive visibility gap", description: `SFB found: "${f}". Review what distinguishes the competitor's presence for this exact query.` }),
  },
};

export async function applyRecommendationsForScan(businessId: string, projectId: string): Promise<{ created: number }> {
  const supabase = createSupabaseServiceClient();

  const [{ data: openFindings }, { data: existingRecs }, { data: mappings }] = await Promise.all([
    supabase.from("audit_findings").select("id, finding, finding_key").eq("business_id", businessId).eq("resolved", false).not("finding_key", "is", null),
    supabase.from("recommendations").select("finding_id").eq("business_id", businessId).not("finding_id", "is", null),
    supabase.from("recommendation_action_mappings").select("finding_kind, recommendation_type, action_catalog_id").eq("active", true),
  ]);

  if (!openFindings || openFindings.length === 0) return { created: 0 };
  const hasRecommendation = new Set((existingRecs ?? []).map((r) => r.finding_id));
  const mappingByKind = new Map((mappings ?? []).map((m) => [`${m.finding_kind}::${m.recommendation_type}`, m.action_catalog_id]));

  let created = 0;
  for (const finding of openFindings) {
    if (hasRecommendation.has(finding.id)) continue;
    const kind = (finding.finding_key as string).split(":")[0];
    const mapper = FINDING_KIND_TO_RECOMMENDATION[kind];
    if (!mapper) continue; // no deterministic mapping -> no recommendation invented

    const { title, description } = mapper.build(finding.finding);
    const actionCatalogId = mappingByKind.get(`${kind}::${mapper.type}`) ?? null; // null = no mapped action; never invented

    const { error } = await supabase.from("recommendations").insert({
      business_id: businessId,
      project_id: projectId,
      finding_id: finding.id,
      title,
      description,
      priority: "medium",
      status: "pending",
      auto_generated: true,
      recommendation_type: mapper.type,
      action_catalog_id: actionCatalogId,
    });
    if (!error) created += 1;
  }
  return { created };
}
