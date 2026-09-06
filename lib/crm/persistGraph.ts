import type { SupabaseClient } from "@supabase/supabase-js";
import type { BusinessGraph } from "@/lib/research/types";

// Shared by "Save as Lead" and "Research Again" so a BusinessGraph is always
// written into the CRM's normalized tables the same way, once.
export async function persistGraphToLead(leadId: string, graph: BusinessGraph, service: SupabaseClient) {
  for (const check of graph.sourceChecks) {
    await service.from("crm_lead_source_checks").insert({
      lead_id: leadId,
      source_url: check.sourceUrl,
      source_type: check.sourceType,
      reachable: check.reachable,
      reason: check.reason || null,
    });
  }

  for (const c of graph.contactMethods) {
    await service.from("crm_lead_contact_methods").insert({ lead_id: leadId, type: c.type, value: c.value, status: c.status, confidence: c.confidence, source_url: c.sourceUrl });
  }

  for (const l of graph.locations) {
    await service.from("crm_lead_locations").insert({
      lead_id: leadId,
      name: l.name,
      address: l.address,
      city: l.city,
      state: l.state,
      postal_code: l.postalCode,
      location_type: l.locationType,
      status: l.status,
      confidence: l.confidence,
      source_url: l.sourceUrl,
    });
  }

  for (const s of graph.socialProfiles) {
    await service.from("crm_lead_social_profiles").insert({
      lead_id: leadId,
      platform: s.platform,
      handle: s.handle,
      url: s.url,
      display_name: s.displayName,
      status: s.status,
      confidence: s.confidence,
      source_url: s.sourceUrl,
    });
  }

  // Backward-compatible flat evidence rows for the deterministic audit scorer.
  const primaryLocation = graph.locations.find((l) => l.locationType === "primary");
  const website = graph.contactMethods.find((c) => c.type === "website");
  const phone = graph.contactMethods.find((c) => c.type === "phone");
  const legacyEvidence = [
    { field: "business_name", value: graph.businessName?.value || null, status: graph.businessName ? "verified" : "not_found", confidence: graph.businessName ? 0.9 : 0, sourceUrl: graph.businessName?.sourceUrl || null },
    { field: "phone", value: phone?.value || null, status: phone?.status || "not_found", confidence: phone?.confidence || 0, sourceUrl: phone?.sourceUrl || null },
    { field: "website", value: website?.value || null, status: website?.status || "not_found", confidence: website?.confidence || 0, sourceUrl: website?.sourceUrl || null },
    { field: "category", value: graph.category, status: graph.category ? "verified" : "not_found", confidence: graph.category ? 0.7 : 0, sourceUrl: null },
    { field: "location", value: primaryLocation ? [primaryLocation.city, primaryLocation.state].filter(Boolean).join(", ") : null, status: primaryLocation?.status || "not_found", confidence: primaryLocation?.confidence || 0, sourceUrl: primaryLocation?.sourceUrl || null },
    { field: "structured_data", value: graph.signals.hasJsonLd ? "present" : "absent", status: graph.signals.hasJsonLd ? "verified" : "not_found", confidence: graph.signals.hasJsonLd ? 1 : 0, sourceUrl: null },
    { field: "https", value: graph.signals.hasHttps ? "yes" : "no", status: graph.signals.hasHttps ? "verified" : "not_found", confidence: graph.signals.hasHttps ? 1 : 0, sourceUrl: null },
    { field: "meta_description", value: graph.signals.hasMetaDescription ? "present" : "absent", status: graph.signals.hasMetaDescription ? "verified" : "not_found", confidence: graph.signals.hasMetaDescription ? 1 : 0, sourceUrl: null },
    { field: "aggregate_rating", value: graph.signals.hasAggregateRating ? "present" : "absent", status: graph.signals.hasAggregateRating ? "verified" : "not_found", confidence: graph.signals.hasAggregateRating ? 1 : 0, sourceUrl: null },
    { field: "social_profiles", value: graph.socialProfiles.length > 0 ? graph.socialProfiles.map((s) => s.platform).join(",") : "none", status: graph.socialProfiles.length > 0 ? "verified" : "not_found", confidence: graph.socialProfiles.length > 0 ? 1 : 0, sourceUrl: null },
  ];
  for (const e of legacyEvidence) {
    await service.from("crm_lead_evidence").insert({
      lead_id: leadId,
      field_name: e.field,
      field_value: e.value,
      status: e.status,
      confidence: e.confidence,
      source_url: e.sourceUrl,
      source_type: e.sourceUrl ? "website" : null,
      research_pass: 8,
    });
  }

  return { website, phone };
}

export async function clearGraphTables(leadId: string, service: SupabaseClient) {
  await Promise.all([
    service.from("crm_lead_contact_methods").delete().eq("lead_id", leadId),
    service.from("crm_lead_locations").delete().eq("lead_id", leadId),
    service.from("crm_lead_social_profiles").delete().eq("lead_id", leadId),
  ]);
}
