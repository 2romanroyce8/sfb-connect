import { createSupabaseServerClient } from "@/lib/supabase/server";

function formatDuration(seconds: number | null) {
  if (seconds == null) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default async function ClockPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: caller } = await supabase.from("users").select("team_role").eq("id", user!.id).single();
  const isOwner = caller?.team_role === "owner";

  // RLS scopes this to the rep's own sessions unless they're the owner.
  const { data: sessions } = await supabase
    .from("team_work_sessions")
    .select("id, rep_id, clocked_in_at, clocked_out_at, duration_seconds, status")
    .order("clocked_in_at", { ascending: false })
    .limit(100);

  let repNames: Record<string, string> = {};
  if (isOwner) {
    const { data: reps } = await supabase.from("users").select("id, full_name, email").not("team_role", "is", null);
    repNames = Object.fromEntries((reps ?? []).map((r) => [r.id, r.full_name || r.email]));
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todaySessions = (sessions ?? []).filter((s) => new Date(s.clocked_in_at) >= todayStart);
  const todayTotal = todaySessions.reduce((sum, s) => sum + (s.duration_seconds || (s.status === "active" ? Math.floor((Date.now() - new Date(s.clocked_in_at).getTime()) / 1000) : 0)), 0);

  return (
    <div className="px-8 py-8">
      <div className="mb-6">
        <div className="text-[20px] font-semibold text-[#F5F5F7]">Clock</div>
        <div className="text-[13px] text-[#6E6E73] mt-1">
          Work-session accountability — not payroll. Today's total: {formatDuration(todayTotal)}
        </div>
      </div>

      {(!sessions || sessions.length === 0) ? (
        <div className="rounded-[14px] p-10 text-center max-w-[480px]" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="text-[15px] font-medium text-[#F5F5F7] mb-1.5">No sessions yet</div>
          <p className="text-[13px] text-[#A1A1A6]">Clock in from the sidebar to start a work session.</p>
        </div>
      ) : (
        <div className="rounded-[12px] overflow-hidden max-w-[720px]" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ background: "#0A0A0A" }}>
                {[...(isOwner ? ["Rep"] : []), "Clocked In", "Clocked Out", "Duration", "Status"].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-[#6E6E73]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  {isOwner && <td className="px-4 py-3 text-[#F5F5F7]">{repNames[s.rep_id] || "—"}</td>}
                  <td className="px-4 py-3 text-[#A1A1A6]">{new Date(s.clocked_in_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-[#A1A1A6]">{s.clocked_out_at ? new Date(s.clocked_out_at).toLocaleString() : "—"}</td>
                  <td className="px-4 py-3 text-[#A1A1A6]">{formatDuration(s.duration_seconds)}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-[6px] h-[6px] rounded-full" style={{ background: s.status === "active" ? "#30D158" : "#6E6E73" }} />
                      <span className="text-[#A1A1A6] capitalize">{s.status === "active" ? "Working" : "Ended"}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
