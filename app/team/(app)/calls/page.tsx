import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const OUTCOME_COLOR: Record<string, string> = {
  booked_meeting: "var(--hx-30d158)",
  interested: "var(--hx-30d158)",
  sale_closed: "var(--hx-30d158)",
  call_back_later: "var(--hx-ffd60a)",
  no_answer: "var(--hx-6e6e73)",
  voicemail: "var(--hx-6e6e73)",
  wrong_number: "var(--hx-ff9f0a)",
  not_interested: "var(--hx-ff453a)",
  hung_up: "var(--hx-ff453a)",
  bad_lead: "var(--hx-ff453a)",
  other: "var(--hx-6e6e73)",
};

function formatDuration(seconds: number | null) {
  if (seconds == null) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

export default async function CallsPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: caller } = await supabase.from("users").select("team_role").eq("id", user!.id).single();
  const isOwner = caller?.team_role === "owner";

  // RLS on crm_calls (rep_id = auth.uid() for a rep, all rows for the
  // owner) is what actually restricts this — the query itself is unfiltered.
  const { data: calls } = await supabase
    .from("crm_calls")
    .select("id, lead_id, rep_id, started_at, ended_at, duration_seconds, outcome, call_type")
    .order("started_at", { ascending: false })
    .limit(100);

  const leadIds = Array.from(new Set((calls ?? []).map((c) => c.lead_id)));
  const repIds = Array.from(new Set((calls ?? []).map((c) => c.rep_id)));

  const [{ data: leads }, { data: reps }] = await Promise.all([
    leadIds.length ? supabase.from("crm_leads").select("id, business_name, phone").in("id", leadIds) : Promise.resolve({ data: [] as any[] }),
    isOwner && repIds.length ? supabase.from("users").select("id, full_name, email").in("id", repIds) : Promise.resolve({ data: [] as any[] }),
  ]);

  const leadMap = Object.fromEntries((leads ?? []).map((l) => [l.id, l]));
  const repMap = Object.fromEntries((reps ?? []).map((r) => [r.id, r.full_name || r.email]));

  return (
    <div className="px-8 py-8">
      <div className="mb-6">
        <div className="text-[20px] font-semibold text-[color:var(--hx-f5f5f7)]">Calls</div>
        <div className="text-[13px] text-[color:var(--hx-6e6e73)] mt-1">{(calls ?? []).length} call{(calls ?? []).length === 1 ? "" : "s"} recorded</div>
      </div>

      {!calls || calls.length === 0 ? (
        <div className="rounded-[14px] p-10 text-center max-w-[480px]" style={{ background: "var(--hx-0a0a0a)", border: "1px solid rgb(var(--w) / 0.08)" }}>
          <div className="text-[15px] font-medium text-[color:var(--hx-f5f5f7)] mb-1.5">No calls recorded</div>
          <p className="text-[13px] text-[color:var(--hx-a1a1a6)]">Calls you start from a lead's Call workspace will show up here.</p>
        </div>
      ) : (
        <div className="rounded-[12px] overflow-hidden" style={{ border: "1px solid rgb(var(--w) / 0.08)" }}>
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ background: "var(--hx-0a0a0a)" }}>
                {["Business", ...(isOwner ? ["Rep"] : []), "Started", "Duration", "Outcome"].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--hx-6e6e73)]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {calls.map((c) => (
                <tr key={c.id} style={{ borderTop: "1px solid rgb(var(--w) / 0.06)" }}>
                  <td className="px-4 py-3">
                    <Link href={`/team/leads/${c.lead_id}`} className="text-[color:var(--hx-f5f5f7)] hover:underline">
                      {leadMap[c.lead_id]?.business_name || "Unknown lead"}
                    </Link>
                  </td>
                  {isOwner && <td className="px-4 py-3 text-[color:var(--hx-a1a1a6)]">{repMap[c.rep_id] || "—"}</td>}
                  <td className="px-4 py-3 text-[color:var(--hx-a1a1a6)]">{new Date(c.started_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-[color:var(--hx-a1a1a6)]">{formatDuration(c.duration_seconds)}</td>
                  <td className="px-4 py-3">
                    {c.outcome ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-[6px] h-[6px] rounded-full" style={{ background: OUTCOME_COLOR[c.outcome] || "var(--hx-6e6e73)" }} />
                        <span className="text-[color:var(--hx-a1a1a6)] capitalize">{c.outcome.replace(/_/g, " ")}</span>
                      </span>
                    ) : (
                      <span className="text-[color:var(--hx-6e6e73)]">In progress</span>
                    )}
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
