import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { ReturnedBusiness } from "./providers";
import { normalizeDomain } from "./providers";

/**
 * AI-DISCOVERED COMPETITOR WRITE PATH (conservative by design).
 *
 * A business entity appearing in a provider response is NOT automatically
 * a competitor. This records it as a CANDIDATE with:
 *   source = 'ai_discovered', verification_status = 'needs_review'
 * plus the evidence (query, platform, project, citation) that surfaced it.
 * A human (team) promotes it to 'verified' or 'dismissed'. Nothing
 * customer-facing treats a needs_review row as a real competitor.
 *
 * Dedup: by normalized domain against (a) the customer's own business
 * domain, (b) existing competitor rows for this business (unique index on
 * business_id + normalized_domain backstops this), (c) directory/social
 * hosts already filtered out upstream by extractBusinessCandidates.
 *
 * Only DOMAIN-backed candidates are stored -- a bare name with no domain
 * cannot be resolved to an identity, so it is skipped rather than guessed.
 * This path has NOT yet been exercised against a real provider response
 * (no credential configured) and must be re-validated when one exists.
 */
export async function recordDiscoveredCompetitors(params: {
  businessId: string;
  businessWebsite: string | null;
  projectId: string;
  platform: string;
  queryText: string;
  candidates: ReturnedBusiness[];
}): Promise<{ recorded: number; skippedSelf: number; skippedExisting: number }> {
  const supabase = createSupabaseServiceClient();
  const selfDomain = normalizeDomain(params.businessWebsite);
  const counts = { recorded: 0, skippedSelf: 0, skippedExisting: 0 };

  const { data: existing } = await supabase.from("competitors").select("normalized_domain, website").eq("business_id", params.businessId);
  const knownDomains = new Set<string>();
  for (const row of existing ?? []) {
    const d = row.normalized_domain ?? normalizeDomain(row.website);
    if (d) knownDomains.add(d);
  }

  for (const c of params.candidates) {
    const domain = c.domain ? normalizeDomain(c.domain) : null;
    if (!domain) continue;
    if (selfDomain && domain === selfDomain) {
      counts.skippedSelf += 1;
      continue;
    }
    if (knownDomains.has(domain)) {
      counts.skippedExisting += 1;
      continue;
    }
    const { error } = await supabase.from("competitors").insert({
      business_id: params.businessId,
      name: c.name,
      website: c.sourceUrl ?? `https://${domain}`,
      normalized_domain: domain,
      source: "ai_discovered",
      verification_status: "needs_review",
      discovered_at: new Date().toISOString(),
      discovered_in_project_id: params.projectId,
      discovery_evidence: { platform: params.platform, query_text: params.queryText, source_url: c.sourceUrl },
      notes: `AI-discovered candidate on ${params.platform} for "${params.queryText}" -- needs review before being treated as a competitor.`,
    });
    // 23505 = the unique (business_id, normalized_domain) index caught a race
    if (!error) {
      knownDomains.add(domain);
      counts.recorded += 1;
    } else if ((error as any).code === "23505") {
      counts.skippedExisting += 1;
    }
  }
  return counts;
}
