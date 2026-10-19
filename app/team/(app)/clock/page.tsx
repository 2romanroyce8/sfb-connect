import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatInTimeZone } from "@/lib/crm/timezone";
import { timezoneLabel } from "@/lib/crm/commonTimezones";

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
  const { data: caller } = await supabase.from("users").select("team_role, home_timezone").eq("id", user!.id).single();
  const isOwner = caller?.team_role === "owner";
  // Every time on this page is rendered in the viewer's own home timezone
  // (Settings → My Timezone), never the server's. The Activity feed uses the
  // same source, so the two views can never disagree.
  const tz = caller?.home_timezone || "America/New_York";
  const fmt = (iso: string) => formatInTimeZone(iso, tz, { month: "numeric", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

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

  const todayKey = formatInTimeZone(new Date().toISOString(), tz, { year: "numeric", month: "2-digit", day: "2-digit" });
  const todaySessions = (sessions ?? []).filter((s) => formatInTimeZone(s.clocked_in_at, tz, { year: "numeric", month: "2-digit", day: "2-digit" }) === todayKey);
  const todayTotal = todaySessions.reduce((sum, s) => sum + (s.duration_seconds || (s.status === "active" ? Math.floor((Date.now() - new Date(s.clocked_in_at).getTime()) / 1000) : 0)), 0);

  return (
    <div className="px-8 py-8">
      <div className="mb-6">
        <div className="text-[20px] font-semibold text-[color:var(--hx-f5f5f7)]">Timesheets</div>
        <div className="text-[13px] text-[color:var(--hx-6e6e73)] mt-1">
          Work-session accountability — not payroll. Today's total: {formatDuration(todayTotal)} · times shown in {timezoneLabel(tz)}
        </div>
      </div>

      {(!sessions || sessions.length === 0) ? (
        <div className="rounded-[14px] p-10 text-center max-w-[480px]" style={{ background: "var(--hx-0a0a0a)", border: "1px solid rgb(var(--w) / 0.08)" }}>
          <div className="text-[15px] font-medium text-[color:var(--hx-f5f5f7)] mb-1.5">No sessions yet</div>
          <p className="text-[13px] text-[color:var(--hx-a1a1a6)]">Clock in from the sidebar to start a work session.</p>
        </div>
      ) : (
        <div className="rounded-[12px] overflow-hidden max-w-[720px]" style={{ border: "1px solid rgb(var(--w) / 0.08)" }}>
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ background: "var(--hx-0a0a0a)" }}>
                {[...(isOwner ? ["Rep"] : []), "Mode", "Clocked In", "Clocked Out", "Duration", "Status"].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--hx-6e6e73)]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} style={{ borderTop: "1px solid rgb(var(--w) / 0.06)" }}>
                  {isOwner && <td className="px-4 py-3 text-[color:var(--hx-f5f5f7)]">{repNames[s.rep_id] || "—"}</td>}
                  <td className="px-4 py-3 text-[color:var(--hx-a1a1a6)]">Work Mode</td>
                  <td className="px-4 py-3 text-[color:var(--hx-a1a1a6)]">{fmt(s.clocked_in_at)}</td>
                  <td className="px-4 py-3 text-[color:var(--hx-a1a1a6)]">{s.clocked_out_at ? fmt(s.clocked_out_at) : "—"}</td>
                  <td className="px-4 py-3 text-[color:var(--hx-a1a1a6)]">{formatDuration(s.duration_seconds)}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-[6px] h-[6px] rounded-full" style={{ background: s.status === "active" ? "var(--hx-30d158)" : "var(--hx-6e6e73)" }} />
                      <span className="text-[color:var(--hx-a1a1a6)] capitalize">{s.status === "active" ? "Working" : "Ended"}</span>
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
