import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SFB_PLAN_LABELS, type PlanKey } from "@/lib/team/plans";
import { getRangeStart, getPreviousRangeBounds, getBucketGranularity, generateBuckets, bucketKeyFor } from "./date-range";
import type { AnalyticsRange, RevenueAnalytics, RevenueTimelinePoint, RevenueByPlanRow, RevenueByRepRow, RecentRevenueRow } from "./types";
import type { AnalyticsScope } from "./permissions";

type RevenueEventRow = {
  id: string;
  lead_id: string | null;
  rep_id: string | null;
  plan_key: string;
  amount: number | string;
  event_type: string;
  occurred_at: string;
};

export async function getRevenueAnalytics(params: {
  scope: AnalyticsScope;
  range: AnalyticsRange;
  planFilter?: PlanKey | null;
}): Promise<RevenueAnalytics> {
  const { scope, range, planFilter } = params;
  const supabase = createSupabaseServerClient();
  const granularity = getBucketGranularity(range);

  // For "all", we need a real earliest-event date to anchor the timeline --
  // otherwise it falls back to "today" (an honest, if unhelpful, empty
  // range) rather than guessing.
  let earliestFallback = new Date();
  if (range === "all") {
    let earliestQuery = supabase.from("revenue_events").select("occurred_at").is("reversed_at", null).order("occurred_at", { ascending: true }).limit(1);
    if (scope.effectiveRepId) earliestQuery = earliestQuery.eq("rep_id", scope.effectiveRepId);
    const { data: earliest } = await earliestQuery;
    if (earliest?.[0]?.occurred_at) earliestFallback = new Date(earliest[0].occurred_at);
  }

  const rangeStart = getRangeStart(range, earliestFallback);
  const rangeEnd = new Date();
  const previousBounds = getPreviousRangeBounds(range, rangeStart);

  function baseQuery() {
    let q = supabase
      .from("revenue_events")
      .select("id, lead_id, rep_id, plan_key, amount, event_type, occurred_at")
      .is("reversed_at", null)
      .gte("occurred_at", rangeStart.toISOString())
      .lte("occurred_at", rangeEnd.toISOString());
    if (scope.effectiveRepId) q = q.eq("rep_id", scope.effectiveRepId);
    if (planFilter) q = q.eq("plan_key", planFilter);
    return q;
  }

  const [{ data: events }, previousResult, { data: reps }] = await Promise.all([
    baseQuery(),
    previousBounds
      ? (() => {
          let q = supabase
            .from("revenue_events")
            .select("amount")
            .is("reversed_at", null)
            .gte("occurred_at", previousBounds.start.toISOString())
            .lte("occurred_at", previousBounds.end.toISOString());
          if (scope.effectiveRepId) q = q.eq("rep_id", scope.effectiveRepId);
          if (planFilter) q = q.eq("plan_key", planFilter);
          return q;
        })()
      : Promise.resolve({ data: null as { amount: number | string }[] | null }),
    scope.isOwner ? supabase.from("users").select("id, full_name, email").not("team_role", "is", null) : Promise.resolve({ data: null }),
  ]);

  const rows = (events ?? []) as RevenueEventRow[];
  const revenue = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
  const dealsWon = rows.length;
  const averageDealValue = dealsWon > 0 ? revenue / dealsWon : 0;

  const previousRevenue = previousBounds ? (previousResult.data ?? []).reduce((s, r) => s + Number(r.amount || 0), 0) : null;
  const changeAmount = previousRevenue !== null ? revenue - previousRevenue : null;
  const changePercent = previousRevenue !== null && previousRevenue > 0 ? (changeAmount! / previousRevenue) * 100 : null;

  // ---- timeline ----
  const buckets = generateBuckets(rangeStart, rangeEnd, granularity);
  const bucketMap = new Map<string, { revenue: number; deals: number }>();
  for (const b of buckets) bucketMap.set(b.key, { revenue: 0, deals: 0 });
  for (const r of rows) {
    const key = bucketKeyFor(r.occurred_at, granularity);
    const bucket = bucketMap.get(key);
    if (bucket) {
      bucket.revenue += Number(r.amount || 0);
      bucket.deals += 1;
    }
  }
  const timeline: RevenueTimelinePoint[] = buckets.map((b) => ({
    key: b.key,
    label: b.label,
    revenue: Math.round((bucketMap.get(b.key)?.revenue ?? 0) * 100) / 100,
    deals: bucketMap.get(b.key)?.deals ?? 0,
  }));

  // ---- by plan ----
  const planTotals = new Map<string, { revenue: number; deals: number }>();
  for (const r of rows) {
    const cur = planTotals.get(r.plan_key) ?? { revenue: 0, deals: 0 };
    cur.revenue += Number(r.amount || 0);
    cur.deals += 1;
    planTotals.set(r.plan_key, cur);
  }
  const byPlan: RevenueByPlanRow[] = Array.from(planTotals.entries())
    .map(([planKey, v]) => ({
      planKey,
      planLabel: SFB_PLAN_LABELS[planKey as PlanKey] || planKey,
      revenue: Math.round(v.revenue * 100) / 100,
      deals: v.deals,
      sharePercent: revenue > 0 ? Math.round((v.revenue / revenue) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  // ---- by rep (owner only) ----
  let byRep: RevenueByRepRow[] | null = null;
  let employees: { id: string; name: string }[] | null = null;
  if (scope.isOwner) {
    const repNameById = Object.fromEntries((reps ?? []).map((r: any) => [r.id, r.full_name || r.email]));
    employees = (reps ?? []).map((r: any) => ({ id: r.id, name: r.full_name || r.email }));
    const repTotals = new Map<string, { revenue: number; deals: number }>();
    for (const r of rows) {
      if (!r.rep_id) continue;
      const cur = repTotals.get(r.rep_id) ?? { revenue: 0, deals: 0 };
      cur.revenue += Number(r.amount || 0);
      cur.deals += 1;
      repTotals.set(r.rep_id, cur);
    }
    byRep = Array.from(repTotals.entries())
      .map(([repId, v]) => ({
        repId,
        repName: repNameById[repId] || "Unknown",
        revenue: Math.round(v.revenue * 100) / 100,
        deals: v.deals,
        averageDealValue: v.deals > 0 ? Math.round((v.revenue / v.deals) * 100) / 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }

  // ---- recent revenue table ----
  const recentRows = [...rows].sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()).slice(0, 25);
  const leadIds = Array.from(new Set(recentRows.map((r) => r.lead_id).filter(Boolean))) as string[];
  const repIds = Array.from(new Set(recentRows.map((r) => r.rep_id).filter(Boolean))) as string[];
  const [{ data: leadsData }, { data: repsData }] = await Promise.all([
    leadIds.length ? supabase.from("crm_leads").select("id, business_name").in("id", leadIds) : Promise.resolve({ data: [] as any[] }),
    repIds.length ? supabase.from("users").select("id, full_name, email").in("id", repIds) : Promise.resolve({ data: [] as any[] }),
  ]);
  const businessNameById = Object.fromEntries((leadsData ?? []).map((l: any) => [l.id, l.business_name]));
  const repNameByIdRecent = Object.fromEntries((repsData ?? []).map((r: any) => [r.id, r.full_name || r.email]));

  const recent: RecentRevenueRow[] = recentRows.map((r) => ({
    id: r.id,
    occurredAt: r.occurred_at,
    businessName: r.lead_id ? businessNameById[r.lead_id] || null : null,
    repName: r.rep_id ? repNameByIdRecent[r.rep_id] || null : null,
    planKey: r.plan_key,
    planLabel: SFB_PLAN_LABELS[r.plan_key as PlanKey] || r.plan_key,
    amount: Number(r.amount || 0),
    eventType: r.event_type,
    leadId: r.lead_id,
  }));

  return {
    range,
    granularity,
    summary: { revenue: Math.round(revenue * 100) / 100, dealsWon, averageDealValue: Math.round(averageDealValue * 100) / 100, previousRevenue, changeAmount, changePercent },
    timeline,
    byPlan,
    byRep,
    recent,
    mrrAvailable: false,
    employees,
  };
}
