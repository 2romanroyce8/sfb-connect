// V1 PRESENCE SCORE METHODOLOGY -- proposed here since no prior automated
// scoring methodology exists in this codebase (the only existing
// presence_scores writer is a human admin manually typing five sub-scores
// in /team; there was never a defined formula to inspect or reuse).
//
// This uses a DIFFERENT methodology_version string ("engine-v1-detection-
// rate") than the legacy manually-entered "v1" scores, specifically so the
// methodology-compatibility guard already built into the portal (Progress/
// Presence pages) never diffs an engine-computed score against a manually
// typed one -- they are genuinely different measurements.
//
// CRITICAL SCORING RULE: not_tested / error / inconclusive observations are
// EXCLUDED from the denominator entirely. A provider outage or an
// unresolved entity match must never lower a customer's score by looking
// like "not detected." Score is null (no row written) when there are zero
// valid (detected/not_detected) observations to compute from.
//
// FORMULA (explicit, deterministic, reproducible):
//   validObservations = observations where status in (detected, not_detected)
//   overall_score = round(100 * count(detected) / count(validObservations))
//
// This is intentionally a single, transparent detection-rate metric for
// v1 -- not a composite of invented sub-dimensions. A future version can
// add platform-coverage or prominence weighting, but only as an explicit,
// versioned change (bump methodology_version, never silently reinterpret
// an existing version's meaning).

export const ENGINE_METHODOLOGY_VERSION = "engine-v1-detection-rate";

export type ScorableObservation = { status: string };

export function computePresenceScore(observations: ScorableObservation[]): number | null {
  const valid = observations.filter((o) => o.status === "detected" || o.status === "not_detected");
  if (valid.length === 0) return null;
  const detected = valid.filter((o) => o.status === "detected").length;
  return Math.round((100 * detected) / valid.length);
}
