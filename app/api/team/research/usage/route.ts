import { NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";

// Real usage numbers, computed from the discovery_search_calls /
// discovery_attempts ledgers -- every count here is something that
// actually happened, not an estimate. Any authenticated staff member can
// see this (it's a shared team resource, not a private record), but the
// raw log tables stay owner-only via RLS -- this route uses the service
// client only to compute the aggregate, the same pattern as the
// leaderboard's safe-projection function.
export async function GET() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const service = createSupabaseServiceClient();
  const { data: settings } = await service
    .from("discovery_budget_settings")
    .select("monthly_free_credit_usd, cost_per_search_usd, period_anchor_day")
    .limit(1)
    .maybeSingle();

  const monthlyFreeCreditUsd = Number(settings?.monthly_free_credit_usd ?? 10);
  const costPerSearchUsd = Number(settings?.cost_per_search_usd ?? 0.007);
  const anchorDay = settings?.period_anchor_day ?? 1;

  const now = new Date();
  let periodStart = new Date(now.getFullYear(), now.getMonth(), anchorDay);
  if (now.getDate() < anchorDay) {
    periodStart = new Date(now.getFullYear(), now.getMonth() - 1, anchorDay);
  }

  const { data: calls } = await service
    .from("discovery_search_calls")
    .select("cost_usd")
    .gte("occurred_at", periodStart.toISOString());

  const searchesUsed = calls?.length ?? 0;
  const costUsedUsd = (calls ?? []).reduce((sum, c) => sum + Number(c.cost_usd), 0);
  const remainingUsd = Math.max(0, monthlyFreeCreditUsd - costUsedUsd);
  const searchesRemainingEstimate = costPerSearchUsd > 0 ? Math.floor(remainingUsd / costPerSearchUsd) : null;
  const percentUsed = monthlyFreeCreditUsd > 0 ? Math.min(100, (costUsedUsd / monthlyFreeCreditUsd) * 100) : 0;

  const { data: attempts } = await service
    .from("discovery_attempts")
    .select("outcome")
    .gte("occurred_at", periodStart.toISOString());

  const found = (attempts ?? []).filter((a) => a.outcome === "found").length;
  const notFound = (attempts ?? []).filter((a) => a.outcome === "not_found").length;
  const unavailable = (attempts ?? []).filter((a) => a.outcome === "discovery_unavailable").length;
  const triedTotal = found + notFound;
  const foundRatePercent = triedTotal > 0 ? Math.round((found / triedTotal) * 1000) / 10 : null;

  return NextResponse.json({
    periodStart: periodStart.toISOString(),
    monthlyFreeCreditUsd,
    costPerSearchUsd,
    searchesUsed,
    costUsedUsd: Math.round(costUsedUsd * 10000) / 10000,
    remainingUsd: Math.round(remainingUsd * 10000) / 10000,
    searchesRemainingEstimate,
    percentUsed: Math.round(percentUsed * 10) / 10,
    attempts: { found, notFound, unavailable, triedTotal },
    foundRatePercent,
  });
}
