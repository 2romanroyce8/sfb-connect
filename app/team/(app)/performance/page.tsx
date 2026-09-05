import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const RANGES: Record<string, number> = { today: 1, "7d": 7, "30d": 30 };

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default async function PerformancePage({ searchParams }: { searchParams: { range?: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: caller } = await supabase.from("users").select("team_role").eq("id", user!.id).single();
  if (caller?.team_role !== "owner") redirect("/team/dashboard");

  const range = searchParams.range && RANGES[searchParams.range] ? searchParams.range : "7d";
  const since = new Date();
  since.setDate(since.getDate() - RANGES[range]);
  since.setHours(0, 0, 0, 0);

  const [{ data: reps }, { data: calls }, { data: meetings }, { data: won }, { data: leadsInRange }] = await Promise.all([
    supabase.from("users").select("id, full_name, email").eq("team_role", "sales_rep"),
    supabase.from("crm_calls").select("id, rep_id, duration_seconds, outcome, started_at").gte("started_at", since.toISOString()),
    supabase.from("crm_meetings").select("id, rep_id, status, scheduled_at").gte("scheduled_at", since.toISOString()),
    supabase.from("crm_leads").select("id, assigned_rep, pipeline_stage, updated_at").eq("pipeline_stage", "won").gte("updated_at", since.toISOString()),
    supabase.from("crm_leads").select("pipeline_stage"),
  ]);

  const totalCalls = calls?.length ?? 0;
  const connectedCalls = (calls ?? []).filter((c) => c.outcome && !["no_answer", "voicemail", "wrong_number"].includes(c.outcome)).length;
  const talkTime = (calls ?? []).reduce((s, c) => s + (c.duration_seconds || 0), 0);
  const completedCalls = (calls ?? []).filter((c) => c.duration_seconds != null);
  const avgDuration = completedCalls.length ? Math.round(talkTime / completedCalls.length) : 0;
  const meetingsBooked = (meetings ?? []).filter((m) => m.status === "booked" || m.status === "completed").length;
  const meetingRate = totalCalls ? Math.round((meetingsBooked / totalCalls) * 100) : 0;
  const completedMeetings = (meetings ?? []).filter((m) => m.status === "completed").length;
  const noShows = (meetings ?? []).filter((m) => m.status === "no_show").length;
  const showRate = meetingsBooked ? Math.round((completedMeetings / meetingsBooked) * 100) : 0;
  const dealsWon = won?.length ?? 0;
  const closeRate = meetingsBooked ? Math.round((dealsWon / meetingsBooked) * 100) : 0;

  const stageCounts: Record<string, number> = {};
  for (const l of leadsInRange ?? []) stageCounts[l.pipeline_stage] = (stageCounts[l.pipeline_stage] || 0) + 1;

  const teamMetrics = [
    { label: "Calls", value: totalCalls },
    { label: "Connected Calls", value: connectedCalls },
    { label: "Talk Time", value: formatDuration(talkTime) },
    { label: "Avg Call Duration", value: formatDuration(avgDuration) },
    { label: "Meetings Booked", value: meetingsBooked },
    { label: "Meeting Rate", value: `${meetingRate}%` },
    { label: "Show Rate", value: `${showRate}% (${noShows} no-shows)` },
    { label: "Deals Won", value: dealsWon },
    { label: "Close Rate", value: `${closeRate}%` },
  ];

  const repRows = (reps ?? []).map((rep) => {
    const repCalls = (calls ?? []).filter((c) => c.rep_id === rep.id);
    const repMeetings = (meetings ?? []).filter((m) => m.rep_id === rep.id && (m.status === "booked" || m.status === "completed"));
    const repWon = (won ?? []).filter((w) => w.assigned_rep === rep.id);
    return {
      id: rep.id,
      name: rep.full_name || rep.email,
      calls: repCalls.length,
      talkTime: repCalls.reduce((s, c) => s + (c.duration_seconds || 0), 0),
      meetings: repMeetings.length,
      won: repWon.length,
      conversion: repCalls.length ? Math.round((repMeetings.length / repCalls.length) * 100) : 0,
    };
  });

  return (
    <div className="px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[20px] font-semibold text-[#F5F5F7]">Performance</div>
          <div className="text-[13px] text-[#6E6E73] mt-1">Company-wide sales performance</div>
        </div>
        <div className="flex items-center gap-1">
          {[
            ["today", "Today"],
            ["7d", "7 Days"],
            ["30d", "30 Days"],
          ].map(([value, label]) => (
            <Link
              key={value}
              href={`/team/performance?range=${value}`}
              className="h-[32px] px-3 inline-flex items-center rounded-[7px] text-[12.5px]"
              style={{
                background: range === value ? "#151515" : "transparent",
                color: range === value ? "#F5F5F7" : "#6E6E73",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 md:grid-cols-5 gap-3 mb-10">
        {teamMetrics.map((m) => (
          <div key={m.label} className="p-4 rounded-[12px]" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="text-[20px] font-semibold text-[#F5F5F7] leading-none">{m.value}</div>
            <div className="text-[11px] text-[#6E6E73] mt-1.5">{m.label}</div>
          </div>
        ))}
      </div>

      <div className="mb-3 text-[13px] font-semibold text-[#F5F5F7]">Rep Comparison</div>
      {repRows.length === 0 ? (
        <div className="rounded-[12px] p-6 text-center" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
          <p className="text-[13px] text-[#A1A1A6]">No sales reps yet — invite your team to see performance comparisons here.</p>
        </div>
      ) : (
        <div className="rounded-[12px] overflow-hidden mb-10" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ background: "#0A0A0A" }}>
                {["Rep", "Calls", "Talk Time", "Meetings", "Wins", "Conversion"].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-[#6E6E73]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {repRows.map((r) => (
                <tr key={r.id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <td className="px-4 py-3 text-[#F5F5F7]">{r.name}</td>
                  <td className="px-4 py-3 text-[#A1A1A6]">{r.calls}</td>
                  <td className="px-4 py-3 text-[#A1A1A6]">{formatDuration(r.talkTime)}</td>
                  <td className="px-4 py-3 text-[#A1A1A6]">{r.meetings}</td>
                  <td className="px-4 py-3 text-[#A1A1A6]">{r.won}</td>
                  <td className="px-4 py-3 text-[#A1A1A6]">{r.conversion}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mb-3 text-[13px] font-semibold text-[#F5F5F7]">Pipeline by Stage</div>
      {Object.keys(stageCounts).length === 0 ? (
        <div className="rounded-[12px] p-6 text-center" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
          <p className="text-[13px] text-[#A1A1A6]">No pipeline movement in this range yet.</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {Object.entries(stageCounts).map(([stage, count]) => (
            <div key={stage} className="px-3 py-2 rounded-[8px] text-[12.5px] text-[#A1A1A6] capitalize" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
              {stage.replace(/_/g, " ")}: {count}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
