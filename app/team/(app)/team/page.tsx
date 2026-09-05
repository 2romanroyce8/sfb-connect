import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import TeamRoster from "@/components/team/TeamRoster";

export default async function TeamManagementPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: caller } = await supabase
    .from("users")
    .select("team_role")
    .eq("id", user!.id)
    .single();

  if (caller?.team_role !== "owner") redirect("/team/dashboard");

  const { data: members } = await supabase
    .from("users")
    .select(
      "id, first_name, last_name, full_name, email, team_role, team_status, invited_at, activated_at, last_active_at"
    )
    .not("team_role", "is", null)
    .order("invited_at", { ascending: true });

  const memberIds = (members ?? []).map((m) => m.id);
  const [{ data: calls }, { data: meetings }, { data: won }] = memberIds.length
    ? await Promise.all([
        supabase.from("crm_calls").select("rep_id, duration_seconds").in("rep_id", memberIds),
        supabase.from("crm_meetings").select("rep_id, status").in("rep_id", memberIds),
        supabase.from("crm_leads").select("assigned_rep").eq("pipeline_stage", "won").in("assigned_rep", memberIds),
      ])
    : [{ data: [] as any[] }, { data: [] as any[] }, { data: [] as any[] }];

  const performance = Object.fromEntries(
    (members ?? []).map((m) => {
      const repCalls = (calls ?? []).filter((c) => c.rep_id === m.id);
      const repMeetings = (meetings ?? []).filter((mt) => mt.rep_id === m.id && (mt.status === "booked" || mt.status === "completed"));
      const repWon = (won ?? []).filter((w) => w.assigned_rep === m.id);
      const talkTime = repCalls.reduce((s, c) => s + (c.duration_seconds || 0), 0);
      return [
        m.id,
        {
          calls: repCalls.length,
          talkTime,
          meetings: repMeetings.length,
          wins: repWon.length,
          conversion: repCalls.length ? Math.round((repMeetings.length / repCalls.length) * 100) : 0,
        },
      ];
    })
  );

  return <TeamRoster members={members ?? []} performance={performance} />;
}
