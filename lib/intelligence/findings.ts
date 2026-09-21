import { createSupabaseServiceClient } from "@/lib/supabase/server";

type ObservationRow = {
  id: string;
  tracked_query_id: string | null;
  query_text: string;
  platform: string;
  status: string;
  competitor_id: string | null;
};

export type GeneratedFinding = { findingKey: string; finding: string; severity: "info" | "minor" | "moderate" | "critical"; evidenceText: string };

/** finding_key encodes the exact condition tested, so resolution can be
 * gated on "was THIS condition actually retested?" (see coverage below). */
export function deriveFindings(yourObservations: ObservationRow[], competitorObservations: ObservationRow[]): GeneratedFinding[] {
  const findings: GeneratedFinding[] = [];

  for (const obs of yourObservations) {
    if (obs.status !== "not_detected") continue;
    findings.push({
      findingKey: `not_detected:${obs.tracked_query_id ?? obs.query_text}:${obs.platform}`,
      finding: `Not detected on ${obs.platform} for "${obs.query_text}"`,
      severity: "moderate",
      evidenceText: `Checked ${obs.platform} for "${obs.query_text}" (observation ${obs.id}) -- business was not returned.`,
    });
  }

  const byQuery = new Map<string, ObservationRow[]>();
  for (const obs of yourObservations) {
    const key = obs.tracked_query_id ?? obs.query_text;
    (byQuery.get(key) ?? byQuery.set(key, []).get(key)!).push(obs);
  }
  for (const [key, rows] of byQuery) {
    const detected = rows.filter((r) => r.status === "detected").map((r) => r.platform);
    const missing = rows.filter((r) => r.status === "not_detected").map((r) => r.platform);
    if (detected.length > 0 && missing.length > 0) {
      findings.push({
        findingKey: `platform_gap:${key}`,
        finding: `Detected on ${detected.join(", ")} but not ${missing.join(", ")} for "${rows[0].query_text}"`,
        severity: "minor",
        evidenceText: `${detected.join(", ")}: detected. ${missing.join(", ")}: not detected.`,
      });
    }
  }

  const yourByTuple = new Map(yourObservations.map((o) => [`${o.platform}::${o.tracked_query_id ?? o.query_text}`, o]));
  for (const comp of competitorObservations) {
    if (comp.status !== "detected") continue;
    const tuple = `${comp.platform}::${comp.tracked_query_id ?? comp.query_text}`;
    const yours = yourByTuple.get(tuple);
    if (yours && yours.status === "not_detected") {
      findings.push({
        findingKey: `competitor_present_gap:${comp.competitor_id}:${tuple}`,
        finding: `A tracked competitor is detected on ${comp.platform} for "${comp.query_text}" while this business is not`,
        severity: "moderate",
        evidenceText: `Competitor observation ${comp.id}: detected. Your observation ${yours.id}: not detected.`,
      });
    }
  }

  return findings;
}

/**
 * Coverage-aware lifecycle (fixes the partial-scan bug):
 *
 *   NOT TESTED  != RESOLVED
 *   ABSENT FROM A PARTIAL SCAN != RESOLVED
 *
 * A previously-open finding may only be marked resolved when the exact
 * (tracked_query, platform) condition it describes was ACTUALLY retested
 * in this scan with a valid (detected/not_detected) result AND the
 * condition is no longer present. `retestedConditions` is the set of
 * "<tracked_query_id>::<platform>" tuples this scan produced a valid
 * observation for. Findings whose condition wasn't in that set are left
 * untouched -- still open, evidence unchanged.
 */
export function conditionTuplesForFindingKey(findingKey: string): { queryKey: string; platform: string | null } {
  const [kind, ...rest] = findingKey.split(":");
  if (kind === "not_detected") return { queryKey: rest[0], platform: rest[1] ?? null };
  if (kind === "platform_gap") return { queryKey: rest[0], platform: null }; // needs the query retested on >=2 platforms
  if (kind === "competitor_present_gap") return { queryKey: rest[3] ?? rest[2], platform: rest[1] ?? null }; // key: kind:competitorId:platform::queryKey
  return { queryKey: rest.join(":"), platform: null };
}

/** Pure, unit-testable resolution rule. A finding's condition counts as
 * retested only if this scan produced a VALID observation for the exact
 * (query, platform) it describes (platform_gap: the query on >=2 platforms). */
export function wasConditionRetested(findingKey: string, retested: { queryKey: string; platform: string }[]): boolean {
  const retestedTuples = new Set(retested.map((r) => `${r.queryKey}::${r.platform}`));
  const retestedQueries = new Map<string, number>();
  for (const r of retested) retestedQueries.set(r.queryKey, (retestedQueries.get(r.queryKey) ?? 0) + 1);
  const { queryKey, platform } = conditionTuplesForFindingKey(findingKey);
  if (platform) return retestedTuples.has(`${queryKey}::${platform}`);
  return (retestedQueries.get(queryKey) ?? 0) >= 2;
}

/** Pure decision: should a previously-open finding be resolved by this scan? */
export function shouldResolveFinding(findingKey: string, stillPresentKeys: Set<string>, retested: { queryKey: string; platform: string }[]): "resolve" | "keep_open_still_present" | "keep_open_not_retested" {
  if (stillPresentKeys.has(findingKey)) return "keep_open_still_present";
  return wasConditionRetested(findingKey, retested) ? "resolve" : "keep_open_not_retested";
}

export async function applyFindingsForScan(
  businessId: string,
  projectId: string,
  generated: GeneratedFinding[],
  retested: { queryKey: string; platform: string }[]
): Promise<{ opened: number; refreshed: number; reopened: number; resolved: number; leftOpenNotRetested: number }> {
  const supabase = createSupabaseServiceClient();
  const { data: existingRows } = await supabase.from("audit_findings").select("id, finding_key, resolved").eq("business_id", businessId).not("finding_key", "is", null);
  const existingByKey = new Map((existingRows ?? []).map((r) => [r.finding_key as string, r]));
  const generatedKeys = new Set(generated.map((g) => g.findingKey));

  const counts = { opened: 0, refreshed: 0, reopened: 0, resolved: 0, leftOpenNotRetested: 0 };

  for (const g of generated) {
    const existing = existingByKey.get(g.findingKey);
    if (!existing) {
      const { error } = await supabase.from("audit_findings").insert({ business_id: businessId, project_id: projectId, finding_key: g.findingKey, finding: g.finding, severity: g.severity, evidence_text: g.evidenceText, resolved: false });
      if (!error) counts.opened += 1;
    } else if (existing.resolved) {
      await supabase.from("audit_findings").update({ resolved: false, resolved_at: null, project_id: projectId, evidence_text: `${g.evidenceText} (reopened -- condition reappeared)` }).eq("id", existing.id);
      counts.reopened += 1;
    } else {
      await supabase.from("audit_findings").update({ evidence_text: g.evidenceText, project_id: projectId }).eq("id", existing.id);
      counts.refreshed += 1;
    }
  }

  for (const [key, row] of existingByKey) {
    if (row.resolved) continue;
    const decision = shouldResolveFinding(key, generatedKeys, retested);
    if (decision === "keep_open_still_present") continue; // already refreshed above
    if (decision === "keep_open_not_retested") {
      counts.leftOpenNotRetested += 1; // partial scan: condition not retested -> stays open, untouched
      continue;
    }
    await supabase.from("audit_findings").update({ resolved: true, resolved_at: new Date().toISOString() }).eq("id", row.id);
    counts.resolved += 1;
  }

  return counts;
}
