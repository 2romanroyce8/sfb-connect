import type { ReturnedBusiness } from "./providers";

export type MatchConfidence = "confirmed_match" | "probable_match" | "ambiguous" | "not_match";

export type BusinessContext = { name: string; website: string | null };

function normalizeDomain(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(llc|inc|co|corp|company|the)\b/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

/** Deterministic, evidence-based entity resolution -- no LLM "decides" a
 * match. Domain equality is the strongest signal (confirmed_match); a
 * normalized name match without a domain to corroborate it is only ever
 * probable_match at best, since two different real businesses can share a
 * name. A generic/very short overlap is ambiguous, not a match. */
export function resolveEntityMatch(business: BusinessContext, candidate: ReturnedBusiness): MatchConfidence {
  const businessDomain = normalizeDomain(business.website);
  if (businessDomain && candidate.domain) {
    if (candidate.domain === businessDomain) return "confirmed_match";
    return "not_match"; // a different real domain is real evidence of a DIFFERENT business
  }

  const businessNameNorm = normalizeName(business.name);
  const candidateNameNorm = normalizeName(candidate.name);
  if (!businessNameNorm || !candidateNameNorm) return "not_match";

  if (businessNameNorm === candidateNameNorm) {
    // Exact normalized name match with no domain to corroborate -- real,
    // but not as strong as a domain match (name collisions happen).
    return "probable_match";
  }

  if (businessNameNorm.length >= 4 && (candidateNameNorm.includes(businessNameNorm) || businessNameNorm.includes(candidateNameNorm))) {
    return "ambiguous";
  }

  return "not_match";
}

export type ResolvedObservationStatus = "detected" | "not_detected" | "inconclusive";

/** Only a confirmed_match (or an explicit probable_match, per the
 * methodology note below) may produce a confident "detected" claim.
 * Ambiguous results become inconclusive rather than a guessed
 * detected/not_detected -- never confidently wrong. */
export function statusFromMatches(matches: MatchConfidence[]): ResolvedObservationStatus {
  if (matches.some((m) => m === "confirmed_match" || m === "probable_match")) return "detected";
  if (matches.some((m) => m === "ambiguous")) return "inconclusive";
  return "not_detected";
}
