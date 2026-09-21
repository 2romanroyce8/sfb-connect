import { NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";

/**
 * Owner-only internal engine observability (item 62). Aggregates from
 * ai_check_jobs / projects / observations -- provider success %, failure
 * codes, average duration, estimated cost, entity-resolution ambiguity,
 * coverage. Never customer-facing; never exposes credentials.
 */
export async function GET() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { data: caller } = await supabase.from("users").select("team_role").eq("id", user.id).single();
  if (caller?.team_role !== "owner") return NextResponse.json({ error: "Owner access required." }, { status: 403 });

  const service = createSupabaseServiceClient();
  const [{ data: jobs }, { data: scans }, { data: obs }] = await Promise.all([
    service.from("ai_check_jobs").select("platform, status, failure_code, duration_ms, cost_estimate_cents, provider_model").order("created_at", { ascending: false }).limit(2000),
    service.from("projects").select("id, status, scan_type, queries_intended, queries_attempted, queries_completed, checks_intended, checks_attempted, checks_completed, estimated_cost_cents, started_at, completed_at").eq("scan_type", "visibility_check").order("started_at", { ascending: false }).limit(50),
    service.from("ai_visibility_observations").select("platform, status, match_confidence").is("competitor_id", null).order("created_at", { ascending: false }).limit(5000),
  ]);

  const byProvider: Record<string, { attempted: number; completed: number; failed: number; skipped: number; avgDurationMs: number | null; estimatedCostCents: number; failureCodes: Record<string, number>; models: string[] }> = {};
  for (const j of jobs ?? []) {
    const p = (byProvider[j.platform] ??= { attempted: 0, completed: 0, failed: 0, skipped: 0, avgDurationMs: null, estimatedCostCents: 0, failureCodes: {}, models: [] });
    p.attempted += 1;
    if (j.status === "completed") p.completed += 1;
    else if (j.status === "failed") p.failed += 1;
    else if (j.status === "skipped_not_configured") p.skipped += 1;
    if (j.failure_code) p.failureCodes[j.failure_code] = (p.failureCodes[j.failure_code] ?? 0) + 1;
    p.estimatedCostCents += Number(j.cost_estimate_cents ?? 0);
    if (j.provider_model && !p.models.includes(j.provider_model)) p.models.push(j.provider_model);
  }
  for (const platform of Object.keys(byProvider)) {
    const durations = (jobs ?? []).filter((j) => j.platform === platform && j.status === "completed" && j.duration_ms != null).map((j) => j.duration_ms as number);
    byProvider[platform].avgDurationMs = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null;
  }

  const statusCounts: Record<string, number> = {};
  const matchCounts: Record<string, number> = {};
  for (const o of obs ?? []) {
    statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1;
    if (o.match_confidence) matchCounts[o.match_confidence] = (matchCounts[o.match_confidence] ?? 0) + 1;
  }

  return NextResponse.json({ providers: byProvider, observationStatusCounts: statusCounts, entityResolutionCounts: matchCounts, recentScans: scans ?? [], costNote: "All cost figures are ESTIMATES from public list pricing, not invoice data." });
}
