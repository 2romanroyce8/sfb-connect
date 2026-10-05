import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ResearchResultView from "@/components/team/ResearchResultView";
import { reconcileGraph } from "@/lib/research/reconcile";
import type { BusinessGraph } from "@/lib/research/types";

export default async function ResearchResultPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: result } = await supabase.from("crm_research_results").select("*").eq("id", params.id).single();
  if (!result) notFound();

  const { data: caller } = await supabase.from("users").select("team_role").eq("id", user!.id).single();
  const isOwner = caller?.team_role === "owner";

  let reps: { id: string; label: string }[] = [];
  if (isOwner) {
    const { data: members } = await supabase.from("users").select("id, full_name, email").not("team_role", "is", null).eq("team_status", "active");
    reps = (members ?? []).map((m) => ({ id: m.id, label: m.full_name || m.email }));
  } else {
    reps = [{ id: user!.id, label: "Me" }];
  }

  // Results researched before the entity layer existed carry no persisted
  // profile. Derive one now from the stored graph -- a deterministic
  // function of data we already have, not new research -- so the identity
  // gate and sections still apply. Nothing is written back.
  let view = result as any;
  if (!result.reconciled_profile && result.graph_json && Array.isArray(result.source_urls) && result.source_urls[0]) {
    try {
      const derived = reconcileGraph(result.graph_json as BusinessGraph, result.source_urls[0]);
      view = {
        ...result,
        reconciled_profile: derived,
        identity_confidence: derived.identity.identityConfidence,
        profile_type: derived.identity.profileType,
        research_status: derived.metrics.researchStatus,
        research_confidence_pct: derived.metrics.researchConfidencePct,
        fields_verified: derived.metrics.fieldsVerified,
        fields_total: derived.metrics.fieldsTotal,
        sources_checked: derived.metrics.sourcesChecked,
        sources_fetched: derived.metrics.sourcesFetched,
        conflicts: derived.conflicts,
        source_type: derived.entities.sourceType,
        entity_type: derived.entities.entityType,
        business_status: derived.entities.businessStatus,
        person_name: derived.entities.person?.name ?? null,
        relationship_type: derived.entities.relationship?.relationshipType ?? null,
        relationship_basis: derived.entities.relationship?.basis ?? null,
        relationship_confidence: derived.entities.relationship?.confidence ?? null,
        limitations: [...derived.limitations, { code: "DERIVED_FROM_LEGACY_GRAPH", message: "This result predates the identity layer; the profile shown was derived from the stored research graph when the page loaded." }],
      };
    } catch {
      // leave the legacy view untouched rather than guess
    }
  }

  return <ResearchResultView result={view} reps={reps} isOwner={isOwner} />;
}
