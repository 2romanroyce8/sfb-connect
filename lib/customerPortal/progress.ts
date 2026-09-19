import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PresencePoint = { id: string; overall_score: number; recorded_at: string; methodology_version: string };

/** Real recorded points only -- never interpolated. Filtered to a real
 * calendar window when one is requested; "all" returns everything. */
export async function getPresenceHistory(businessId: string, windowDays: number | null): Promise<PresencePoint[]> {
  const supabase = createSupabaseServerClient();
  let query = supabase
    .from("presence_scores")
    .select("id, overall_score, recorded_at, methodology_version")
    .eq("business_id", businessId)
    .order("recorded_at", { ascending: true });

  if (windowDays) {
    const since = new Date();
    since.setDate(since.getDate() - windowDays);
    query = query.gte("recorded_at", since.toISOString());
  }

  const { data } = await query;
  return data ?? [];
}

export type ProgressMetrics = {
  trackedQueries: number;
  detectedQueries: number;
  platformsTested: number;
  findingsResolved: number;
  recommendationsCompleted: number;
  reportsGenerated: number;
};

export async function getProgressMetrics(businessId: string): Promise<ProgressMetrics> {
  const supabase = createSupabaseServerClient();
  const [{ data: obs }, { data: findings }, { data: recs }, { count: reportsCount }] = await Promise.all([
    // Ordered ascending so that when multiple rows share a tuple, the
    // LATEST one is processed last and wins the `tuples.set()` call below
    // -- without this, Postgres's unordered scan order determines which
    // row "wins," making detectedQueries silently non-deterministic.
    supabase
      .from("ai_visibility_observations")
      .select("platform, query_text, location_id, status")
      .eq("business_id", businessId)
      .is("competitor_id", null)
      .order("created_at", { ascending: true }),
    supabase.from("audit_findings").select("id").eq("business_id", businessId).eq("resolved", true),
    supabase.from("recommendations").select("id").eq("business_id", businessId).eq("status", "done"),
    supabase.from("reports").select("id", { count: "exact", head: true }).eq("business_id", businessId).not("published_at", "is", null),
  ]);

  const tuples = new Map<string, string>(); // key -> latest status (any row counts as tracked)
  const platforms = new Set<string>();
  for (const o of obs ?? []) {
    const key = `${o.platform}::${o.query_text}::${o.location_id ?? ""}`;
    tuples.set(key, o.status);
    if (o.status !== "not_tested") platforms.add(o.platform);
  }
  const detectedQueries = Array.from(tuples.values()).filter((s) => s === "detected").length;

  return {
    trackedQueries: tuples.size,
    detectedQueries,
    platformsTested: platforms.size,
    findingsResolved: findings?.length ?? 0,
    recommendationsCompleted: recs?.length ?? 0,
    reportsGenerated: reportsCount ?? 0,
  };
}

export type ChangeEvent = {
  id: string;
  kind: "score_change" | "query_detected" | "query_not_detected" | "finding_resolved" | "recommendation_completed" | "report_generated";
  description: string;
  timestamp: string;
};

/**
 * A real chronological "what changed" feed. Score deltas come from
 * consecutive presence_scores under the SAME methodology (same guard as
 * everywhere else). Query status transitions come from comparing each
 * observation to the immediately prior one for the SAME tuple -- both are
 * derived from actual stored rows, nothing synthesized.
 */
export async function getWhatChangedFeed(businessId: string, limit = 15): Promise<ChangeEvent[]> {
  const supabase = createSupabaseServerClient();
  const [{ data: scores }, { data: obsRows }, { data: findings }, { data: recs }, { data: reports }] = await Promise.all([
    supabase.from("presence_scores").select("id, overall_score, methodology_version, recorded_at").eq("business_id", businessId).order("recorded_at", { ascending: true }),
    supabase
      .from("ai_visibility_observations")
      .select("id, platform, query_text, location_id, status, checked_at, created_at")
      .eq("business_id", businessId)
      .is("competitor_id", null)
      .order("created_at", { ascending: true }),
    supabase.from("audit_findings").select("id, finding, resolved_at").eq("business_id", businessId).eq("resolved", true).not("resolved_at", "is", null),
    supabase.from("recommendations").select("id, title, completed_at").eq("business_id", businessId).eq("status", "done").not("completed_at", "is", null),
    supabase.from("reports").select("id, report_type, published_at").eq("business_id", businessId).not("published_at", "is", null),
  ]);

  const events: ChangeEvent[] = [];

  const sameMethodology: Record<string, typeof scores> = {};
  for (const s of scores ?? []) {
    (sameMethodology[s.methodology_version] ??= []).push(s);
  }
  for (const version of Object.keys(sameMethodology)) {
    const rows = sameMethodology[version]!;
    for (let i = 1; i < rows.length; i++) {
      const delta = rows[i].overall_score - rows[i - 1].overall_score;
      if (delta === 0) continue;
      events.push({
        id: `score-${rows[i].id}`,
        kind: "score_change",
        description: `AI Presence score ${delta > 0 ? "increased" : "decreased"} by ${Math.abs(delta)} points`,
        timestamp: rows[i].recorded_at,
      });
    }
  }

  const byTuple: Record<string, typeof obsRows> = {};
  for (const o of obsRows ?? []) {
    const key = `${o.platform}::${o.query_text}::${o.location_id ?? ""}`;
    (byTuple[key] ??= []).push(o);
  }
  for (const key of Object.keys(byTuple)) {
    const rows = byTuple[key]!;
    for (let i = 1; i < rows.length; i++) {
      const prev = rows[i - 1].status;
      const curr = rows[i].status;
      if (prev === curr) continue;
      if (curr === "detected") {
        events.push({
          id: `obs-${rows[i].id}`,
          kind: "query_detected",
          description: `"${rows[i].query_text}" became detected on ${rows[i].platform}`,
          timestamp: rows[i].checked_at || rows[i].created_at,
        });
      } else if (curr === "not_detected" && prev === "detected") {
        events.push({
          id: `obs-${rows[i].id}`,
          kind: "query_not_detected",
          description: `"${rows[i].query_text}" is no longer detected on ${rows[i].platform}`,
          timestamp: rows[i].checked_at || rows[i].created_at,
        });
      }
    }
  }

  for (const f of findings ?? []) {
    events.push({ id: `find-${f.id}`, kind: "finding_resolved", description: `Resolved: ${f.finding}`, timestamp: f.resolved_at as string });
  }
  for (const r of recs ?? []) {
    events.push({ id: `rec-${r.id}`, kind: "recommendation_completed", description: `Completed: ${r.title}`, timestamp: r.completed_at as string });
  }
  for (const rep of reports ?? []) {
    events.push({
      id: `report-${rep.id}`,
      kind: "report_generated",
      description: `${rep.report_type ? rep.report_type.replace(/_/g, " ") : "Report"} generated`,
      timestamp: rep.published_at as string,
    });
  }

  return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, limit);
}
