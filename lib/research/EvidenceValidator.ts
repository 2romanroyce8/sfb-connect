import type { Candidate, FieldStatus } from "./types";

export type Resolved<T = string> = { value: T | null; status: FieldStatus; confidence: number; sources: string[] };

// Resolves a single-value field (business name, primary phone, website,
// category) from competing candidates. Distinct from location/social
// discovery, which deliberately keeps MULTIPLE valid records instead of
// collapsing to one winner — that distinction is the fix for treating
// "Sacramento" and "Elk Grove" as a conflict when they're really two valid
// service areas.
export function resolveField<T = string>(candidates: Candidate<T>[]): Resolved<T> {
  if (candidates.length === 0) return { value: null, status: "not_found", confidence: 0, sources: [] };

  const key = (v: T) => (typeof v === "string" ? v.toLowerCase() : JSON.stringify(v));
  const distinctValues = Array.from(new Set(candidates.map((c) => key(c.value))));
  const bySources = new Set(candidates.map((c) => c.sourceUrl));
  const best = [...candidates].sort((a, b) => b.strength - a.strength)[0];

  if (distinctValues.length > 1 && bySources.size > 1) {
    const conflicting = candidates.some((c) => c.strength >= 2 && key(c.value) !== key(best.value));
    if (conflicting) {
      return { value: best.value, status: "conflict", confidence: 0.4, sources: candidates.map((c) => c.sourceUrl) };
    }
  }

  const agreeingSources = new Set(candidates.filter((c) => key(c.value) === key(best.value)).map((c) => c.sourceUrl));
  if (best.strength >= 3 || agreeingSources.size > 1) {
    return { value: best.value, status: "verified", confidence: 0.9, sources: Array.from(agreeingSources) };
  }
  return { value: best.value, status: "uncertain", confidence: 0.5, sources: Array.from(agreeingSources) };
}
