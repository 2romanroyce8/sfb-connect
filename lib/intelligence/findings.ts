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

/**
 * Derives findings from a completed scan's observations -- every finding
 * traces back to specific real observations (recorded in evidence_text),
 * never a vague generic statement. `finding_key` is the dedup/lifecycle
 * anchor: the SAME underlying condition (same query, same kind of gap)
 * reuses the same key across scans rather than creating a fresh row every
 * time, per the required lifecycle behavior.
 */
export function deriveFindings(yourObservations: ObservationRow[], competitorObservations: ObservationRow[]): GeneratedFinding[] {
  const findings: GeneratedFinding[] = [];

  // 1. Not detected for a tracked query at all.
  for (const obs of yourObservations) {
    if (obs.status !== "not_detected") continue;
    findings.push({
      findingKey: `not_detected:${obs.tracked_query_id ?? obs.query_text}:${obs.platform}`,
      finding: `Not detected on ${obs.platform} for "${obs.query_text}"`,
      severity: "moderate",
      evidenceText: `Checked ${obs.platform} for "${obs.query_text}" -- business was not returned.`,
    });
  }

  // 2. Detected on one platform but not another, for the SAME tracked query.
  const byQuery = new Map<string, ObservationRow[]>();
  for (const obs of yourObservations) {
    const key = obs.tracked_query_id ?? obs.query_text;
    (byQuery.get(key) ?? byQuery.set(key, []).get(key)!).push(obs);
  }
  for (const [key, rows] of byQuery) {
    const detectedPlatforms = rows.filter((r) => r.status === "detected").map((r) => r.platform);
    const missingPlatforms = rows.filter((r) => r.status === "not_detected").map((r) => r.platform);
    if (detectedPlatforms.length > 0 && missingPlatforms.length > 0) {
      findings.push({
        findingKey: `platform_gap:${key}`,
        finding: `Detected on ${detectedPlatforms.join(", ")} but not ${missingPlatforms.join(", ")} for "${rows[0].query_text}"`,
        severity: "minor",
        evidenceText: `${detectedPlatforms.join(", ")}: detected. ${missingPlatforms.join(", ")}: not detected.`,
      });
    }
  }

  // 3. Competitor consistently detected where customer is absent (same
  // tracked query, same platform -- a genuinely comparable pair).
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
 * Applies lifecycle rules: same finding_key + still open -> update evidence,
 * stay open. Same finding_key + previously resolved + condition recurs ->
 * reopen (documented rule: clear resolved_at, note the reappearance in
 * evidence_text). Condition no longer present in this scan for a
 * previously-open finding -> mark resolved. New condition -> insert.
 */
export async function applyFindingsForScan(businessId: string, projectId: string, generated: GeneratedFinding[]): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const { data: existingRows } = await supabase.from("audit_findings").select("id, finding_key, resolved").eq("business_id", businessId).not("finding_key", "is", null);
  const existingByKey = new Map((existingRows ?? []).map((r) => [r.finding_key as string, r]));
  const generatedKeys = new Set(generated.map((g) => g.findingKey));

  for (const g of generated) {
    const existing = existingByKey.get(g.findingKey);
    if (!existing) {
      await supabase.from("audit_findings").insert({
        business_id: businessId,
        project_id: projectId,
        finding_key: g.findingKey,
        finding: g.finding,
        severity: g.severity,
        evidence_text: g.evidenceText,
        resolved: false,
      });
    } else if (existing.resolved) {
      // Reopen -- the condition recurred after being marked resolved.
      await supabase
        .from("audit_findings")
        .update({ resolved: false, resolved_at: null, evidence_text: `${g.evidenceText} (reopened -- condition reappeared)` })
        .eq("id", existing.id);
    } else {
      // Still open -- refresh evidence, no new row.
      await supabase.from("audit_findings").update({ evidence_text: g.evidenceText, project_id: projectId }).eq("id", existing.id);
    }
  }

  // Anything previously open, tied to this business, whose condition did
  // NOT recur in this scan -- mark resolved.
  for (const [key, row] of existingByKey) {
    if (!row.resolved && !generatedKeys.has(key)) {
      await supabase.from("audit_findings").update({ resolved: true, resolved_at: new Date().toISOString() }).eq("id", row.id);
    }
  }
}
