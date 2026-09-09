import { NextRequest, NextResponse } from "next/server";
import { resolveAnalyticsScope } from "@/lib/team/analytics/permissions";
import { getRevenueAnalytics } from "@/lib/team/analytics/revenue";
import { isAnalyticsRange } from "@/lib/team/analytics/date-range";
import { isPlanKey } from "@/lib/team/plans";

// Aggregation happens entirely server-side (Supabase queries + JS
// aggregation over the result), never by shipping every revenue_events row
// to the browser. Scope is resolved from the session, not trusted from
// query params -- a rep requesting repId=<someone else> is silently
// ignored by resolveAnalyticsScope.
export async function GET(req: NextRequest) {
  let scope;
  try {
    scope = await resolveAnalyticsScope(req.nextUrl.searchParams.get("repId"));
  } catch {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rangeParam = req.nextUrl.searchParams.get("range") || "30d";
  const range = isAnalyticsRange(rangeParam) ? rangeParam : "30d";

  const planParam = req.nextUrl.searchParams.get("plan");
  const planFilter = isPlanKey(planParam) ? planParam : null;

  const analytics = await getRevenueAnalytics({ scope, range, planFilter });
  return NextResponse.json(analytics);
}
