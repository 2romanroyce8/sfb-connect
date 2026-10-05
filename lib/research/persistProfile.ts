import type { SupabaseClient } from "@supabase/supabase-js";
import type { ResearchProfile } from "./reconcile";
import { assertOk } from "@/lib/supabase/assertOk";

/** Columns on crm_research_results derived from a reconciled profile.
 * Shared by the initial import and Research More so the two can't drift. */
export function profileColumns(profile: ResearchProfile) {
  const e = profile.entities;
  return {
    research_status: profile.metrics.researchStatus,
    identity_confidence: profile.identity.identityConfidence,
    profile_type: profile.identity.profileType,
    research_confidence_pct: profile.metrics.researchConfidencePct,
    fields_verified: profile.metrics.fieldsVerified,
    fields_total: profile.metrics.fieldsTotal,
    sources_checked: profile.metrics.sourcesChecked,
    sources_fetched: profile.metrics.sourcesFetched,
    conflicts: profile.conflicts,
    limitations: profile.limitations,
    reconciled_profile: profile,
    primary_phone_e164: profile.contacts.phones.find((p) => p.status === "CONFIRMED" || p.status === "CONFLICT")?.normalized ?? null,
    source_type: e.sourceType,
    entity_type: e.entityType,
    business_status: e.businessStatus,
    person_name: e.person?.name ?? null,
    relationship_type: e.relationship?.relationshipType ?? null,
    relationship_basis: e.relationship?.basis ?? null,
    relationship_confidence: e.relationship?.confidence ?? null,
  };
}

/** Replaces the source-entity rows and the person/business/relationship
 * rows for a result. Idempotent: safe to call again after Research More. */
export async function persistProfileEntities(service: SupabaseClient, resultId: string, profile: ResearchProfile) {
  assertOk(await service.from("crm_research_sources").delete().eq("research_result_id", resultId), "clear research sources", { resultId });
  if (profile.sources.length > 0) {
    assertOk(
      await service.from("crm_research_sources").insert(
        profile.sources.map((src) => ({
          research_result_id: resultId, ordinal: src.ordinal, url: src.url, canonical_url: src.canonicalUrl, platform: src.platform, link_type: src.linkType,
          priority: src.priority, is_first_party: src.isFirstParty, association: src.association, discovered_from_ordinal: src.discoveredFromOrdinal,
          discovery_method: src.discoveryMethod, depth: src.depth, fetch_status: src.fetchStatus, skip_reason: src.skipReason, profile_type: src.profileType, links_to_seed: src.linksToSeed,
          fetched_at: src.fetchStatus === "fetched" ? new Date().toISOString() : null,
        }))
      ),
      "persist research sources",
      { resultId }
    );
  }

  assertOk(await service.from("crm_research_entity_relationships").delete().eq("research_result_id", resultId), "clear entity relationships", { resultId });
  assertOk(await service.from("crm_research_entities").delete().eq("research_result_id", resultId), "clear entities", { resultId });

  const e = profile.entities;
  let personId: string | null = null;
  let businessId: string | null = null;
  if (e.person) {
    const { data } = assertOk(
      await service.from("crm_research_entities").insert({
        research_result_id: resultId, entity_kind: "person", name: e.person.name, confidence: e.person.confidence, sources: e.person.sources,
        attributes: { facebookUrl: e.person.facebookUrl, facebookUsername: e.person.facebookUsername, bio: e.person.bio, publicLocation: e.person.publicLocation, role: e.person.role, sourceType: e.sourceType },
      }).select("id").single(),
      "insert person entity",
      { resultId }
    );
    personId = data?.id ?? null;
  }
  if (e.business && (e.business.name || e.business.candidates.length)) {
    const { data } = assertOk(
      await service.from("crm_research_entities").insert({
        research_result_id: resultId, entity_kind: "business", name: e.business.name, confidence: e.business.confidence, sources: e.business.candidates.find((c) => c.value === e.business!.name)?.sources ?? [],
        attributes: { status: e.business.status, candidates: e.business.candidates, website: profile.website.value, phone: profile.contacts.phones[0]?.normalized ?? null, category: profile.identity.category.value, city: profile.locations.physical[0]?.city ?? null, state: profile.locations.physical[0]?.state ?? null },
      }).select("id").single(),
      "insert business entity",
      { resultId }
    );
    businessId = data?.id ?? null;
  }
  if (e.relationship && (personId || businessId)) {
    assertOk(
      await service.from("crm_research_entity_relationships").insert({
        research_result_id: resultId, person_entity_id: personId, business_entity_id: businessId,
        relationship_type: e.relationship.relationshipType, basis: e.relationship.basis, confidence: e.relationship.confidence, sources: e.relationship.evidence, explanation: e.relationship.explanation,
      }),
      "insert entity relationship",
      { resultId }
    );
  }
}
