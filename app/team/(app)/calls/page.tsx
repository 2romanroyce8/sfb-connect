import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const OUTCOME_COLOR: Record<string, string> = {
  booked_meeting: "#30D158",
  interested: "#30D158",
  sale_closed: "#30D158",
  call_back_later: "#FFD60A",
  no_answer: "#6E6E73",
  voicemail: "#6E6E73",
  wrong_number: "#FF9F0A",
  not_interested: "#FF453A",
  hung_up: "#FF453A",
  bad_lead: "#FF453A",
  other: "#6E6E73",
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
        <div className="text-[20px] font-semibold text-[#F5F5F7]">Calls</div>
        <div className="text-[13px] text-[#6E6E73] mt-1">{(calls ?? []).length} call{(calls ?? []).length === 1 ? "" : "s"} recorded</div>
      </div>

      {!calls || calls.length === 0 ? (
        <div className="rounded-[14px] p-10 text-center max-w-[480px]" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="text-[15px] font-medium text-[#F5F5F7] mb-1.5">No calls recorded</div>
          <p className="text-[13px] text-[#A1A1A6]">Calls you start from a lead's Call workspace will show up here.</p>
        </div>
      ) : (
        <div className="rounded-[12px] overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ background: "#0A0A0A" }}>
                {["Business", ...(isOwner ? ["Rep"] : []), "Started", "Duration", "Outcome"].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-[#6E6E73]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {calls.map((c) => (
                <tr key={c.id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <td className="px-4 py-3">
                    <Link href={`/team/leads/${c.lead_id}`} className="text-[#F5F5F7] hover:underline">
                      {leadMap[c.lead_id]?.business_name || "Unknown lead"}
                    </Link>
                  </td>
                  {isOwner && <td className="px-4 py-3 text-[#A1A1A6]">{repMap[c.rep_id] || "—"}</td>}
                  <td className="px-4 py-3 text-[#A1A1A6]">{new Date(c.started_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-[#A1A1A6]">{formatDuration(c.duration_seconds)}</td>
                  <td className="px-4 py-3">
                    {c.outcome ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-[6px] h-[6px] rounded-full" style={{ background: OUTCOME_COLOR[c.outcome] || "#6E6E73" }} />
                        <span className="text-[#A1A1A6] capitalize">{c.outcome.replace(/_/g, " ")}</span>
                      </span>
                    ) : (
                      <span className="text-[#6E6E73]">In progress</span>
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
