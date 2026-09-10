import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPeriodBounds, type LeaderboardPeriod } from "@/lib/team/competition/periods";

const VALID_PERIODS: LeaderboardPeriod[] = ["today", "week", "month", "all"];

// Serves the leaderboard exclusively through the get_leaderboard() SECURITY
// DEFINER function -- every authenticated staff member can call this (it's
// the one sanctioned exception to normal cross-rep privacy), but it only
// ever returns the safe aggregate columns baked into that function. Nothing
// here queries staff_point_events/crm_calls/crm_leads directly for anyone
// other than the caller.
export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const periodParam = req.nextUrl.searchParams.get("period") || "week";
  const period: LeaderboardPeriod = VALID_PERIODS.includes(periodParam as LeaderboardPeriod) ? (periodParam as LeaderboardPeriod) : "week";
  const { start, end } = getPeriodBounds(period);

  const { data, error } = await supabase.rpc("get_leaderboard", {
    range_start: start.toISOString(),
    range_end: end.toISOString(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const rows = (data ?? []).map((r: any, i: number) => ({
    userId: r.user_id,
    displayName: r.display_name,
    avatarUrl: r.avatar_url,
    points: Number(r.points),
    dealsWon: Number(r.deals_won),
    meetingsAttended: Number(r.meetings_attended),
    revenue: Number(r.revenue),
    rank: i + 1,
  }));

  return NextResponse.json({ period, rows });
}
