// V1 PRESENCE SCORE METHODOLOGY -- unchanged this phase (per instruction:
// keep the detection-rate component, do not silently replace it).
//
// FORMULA (explicit, deterministic, reproducible):
//   validObservations = observations where status in (detected, not_detected)
//   overall_score = round(100 * count(detected) / count(validObservations))
//
// not_tested / error / inconclusive are EXCLUDED from the denominator: a
// provider outage or an unresolved entity match must never lower a score.
// Score is null (no row written, customer sees NOT ENOUGH DATA) when there
// are zero valid observations.
//
// Distinct methodology_version keeps engine scores from ever being diffed
// against the legacy manually-typed admin "v1" scores.

export const ENGINE_METHODOLOGY_VERSION = "engine-v1-detection-rate";

export type ScorableObservation = { status: string; platform?: string; tracked_query_id?: string | null; query_text?: string };

export function computePresenceScore(observations: ScorableObservation[]): number | null {
  const valid = observations.filter((o) => o.status === "detected" || o.status === "not_detected");
  if (valid.length === 0) return null;
  const detected = valid.filter((o) => o.status === "detected").length;
  return Math.round((100 * detected) / valid.length);
}

// EVIDENCE SUFFICIENCY -- a SEPARATE, deterministic qualifier stored next to
// the score, so a 90/100 built on 2 observations never looks as
// authoritative as a 90/100 built on 40. This is NOT another AI-judged
// number; it is a fixed function of measurable coverage.
//
// Inputs (all countable from the scan's own observation rows):
//   validCount       = detected + not_detected
//   queriesTested    = distinct tracked queries with >=1 valid observation
//   platformsTested  = distinct platforms with >=1 valid observation
//   errorShare       = (error + inconclusive) / total observations
//
// Thresholds (explicit, versioned with the methodology):
//   insufficient : validCount == 0
//   low          : validCount < 5  OR platformsTested == 1  OR errorShare > 0.5
//   medium       : validCount < 15 OR platformsTested < 3   OR errorShare > 0.25
//   high         : everything else

export type EvidenceConfidence = "insufficient" | "low" | "medium" | "high";

export type EvidenceSummary = {
  confidence: EvidenceConfidence;
  validCount: number;
  queriesTested: number;
  platformsTested: number;
  errorInconclusiveCount: number;
};

export function computeEvidenceConfidence(observations: ScorableObservation[]): EvidenceSummary {
  const valid = observations.filter((o) => o.status === "detected" || o.status === "not_detected");
  const errorInconclusive = observations.filter((o) => o.status === "error" || o.status === "inconclusive").length;
  const queriesTested = new Set(valid.map((o) => o.tracked_query_id ?? o.query_text ?? "")).size;
  const platformsTested = new Set(valid.map((o) => o.platform ?? "")).size;
  const total = observations.length;
  const errorShare = total === 0 ? 0 : errorInconclusive / total;

  let confidence: EvidenceConfidence;
  if (valid.length === 0) confidence = "insufficient";
  else if (valid.length < 5 || platformsTested <= 1 || errorShare > 0.5) confidence = "low";
  else if (valid.length < 15 || platformsTested < 3 || errorShare > 0.25) confidence = "medium";
  else confidence = "high";

  return { confidence, validCount: valid.length, queriesTested, platformsTested, errorInconclusiveCount: errorInconclusive };
}
