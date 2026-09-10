import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPeriodBounds } from "@/lib/team/competition/periods";
import CompetitionLeaderboard from "@/components/team/CompetitionLeaderboard";

export default async function LeaderboardPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase.from("users").select("team_role").eq("id", user!.id).single();
  const isOwner = profile?.team_role === "owner";

  const { start, end } = getPeriodBounds("week");
  const { data: rows } = await supabase.rpc("get_leaderboard", { range_start: start.toISOString(), range_end: end.toISOString() });

  const initialRows = (rows ?? []).map((r: any, i: number) => ({
    userId: r.user_id,
    displayName: r.display_name,
    avatarUrl: r.avatar_url,
    points: Number(r.points),
    dealsWon: Number(r.deals_won),
    meetingsAttended: Number(r.meetings_attended),
    revenue: Number(r.revenue),
    rank: i + 1,
  }));

  // Recent point activity is the viewer's OWN raw ledger only -- RLS
  // (rep_read_own_point_events) already guarantees a non-owner query like
  // this can never return another rep's rows, so no extra filtering is
  // needed here beyond what the policy enforces.
  const { data: recentEvents } = await supabase
    .from("staff_point_events")
    .select("id, event_type, points, description, occurred_at, reversed")
    .eq("user_id", user!.id)
    .order("occurred_at", { ascending: false })
    .limit(15);

  return (
    <div className="px-8 py-8">
      <CompetitionLeaderboard
        initialRows={initialRows}
        initialPeriod="week"
        currentUserId={user!.id}
        isOwner={isOwner}
        recentEvents={recentEvents ?? []}
      />
    </div>
  );
}
