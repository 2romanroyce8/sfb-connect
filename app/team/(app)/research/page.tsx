import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ActiveResearchJobs from "@/components/team/ActiveResearchJobs";
import ResearchUsageBar from "@/components/team/ResearchUsageBar";

export default async function ResearchQueuePage() {
  const supabase = createSupabaseServerClient();

  // Best-first: confirmed identity and higher research confidence float to
  // the top so reps spend their time on the most saveable results.
  const { data: results } = await supabase
    .from("crm_research_results")
    .select("id, business_name, website, phone, category, research_completeness, status, created_at, identity_confidence, research_status, research_confidence_pct, fields_verified, fields_total, conflicts, profile_type")
    .eq("status", "pending")
    .order("research_confidence_pct", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  // Failed jobs from the last 7 days -- a result that never materialised is a
  // queue state, not something that silently vanishes.
  const { data: failedJobs } = await supabase
    .from("crm_research_jobs")
    .select("id, started_for, error_code, error_message, created_at")
    .eq("status", "failed")
    .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString())
    .order("created_at", { ascending: false })
    .limit(20);

  const IDENTITY_COLOR: Record<string, string> = { confirmed: "#30D158", uncertain: "#FFD60A", conflict: "#FF9F0A", not_found: "#6E6E73" };

  return (
    <div className="px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[20px] font-semibold text-[#F5F5F7]">Research Queue</div>
          <div className="text-[13px] text-[#6E6E73] mt-1">
            {(results ?? []).length} pending — not yet saved as leads
          </div>
        </div>
        <Link href="/team/leads/import" className="h-[38px] px-4 inline-flex items-center rounded-[8px] bg-white text-black text-[13px] font-semibold">
          Research a Business
        </Link>
      </div>

      <ResearchUsageBar />
      <ActiveResearchJobs />

      {failedJobs && failedJobs.length > 0 && (
        <div className="mb-6">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[#6E6E73] mb-2">Failed ({failedJobs.length}, last 7 days)</div>
          <div className="rounded-[12px] overflow-hidden" style={{ border: "1px solid rgba(255,69,58,0.25)" }}>
            {failedJobs.map((j, i) => (
              <div key={j.id} className="flex items-center gap-3 px-4 py-2.5 text-[12.5px]" style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.06)" : undefined, background: "#0A0A0A" }}>
                <span className="text-[#F5F5F7] truncate flex-1">{j.started_for || "Unknown source"}</span>
                <span className="text-[#FF453A] shrink-0 text-[11.5px]">{j.error_code || "FAILED"}</span>
                <span className="text-[#6E6E73] truncate max-w-[320px] text-[11.5px]">{j.error_message}</span>
                <span className="text-[#6E6E73] shrink-0 text-[11.5px]">{new Date(j.created_at).toLocaleDateString()}</span>
                {j.started_for && (
                  <Link href={`/team/leads/import?source=${encodeURIComponent(j.started_for)}`} className="shrink-0 h-[28px] px-2.5 inline-flex items-center rounded-[6px] text-[11.5px] font-semibold" style={{ background: "#151515", color: "#F5F5F7", border: "1px solid rgba(255,255,255,0.1)" }}>
                    Retry
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!results || results.length === 0 ? (
        <div className="rounded-[14px] p-10 text-center max-w-[480px]" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="text-[15px] font-medium text-[#F5F5F7] mb-1.5">Nothing pending</div>
          <p className="text-[13px] text-[#A1A1A6]">Research a business — it'll wait here until you save it as a lead.</p>
        </div>
      ) : (
        <div className="rounded-[12px] overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ background: "#0A0A0A" }}>
                {["Business", "Identity", "Confidence", "Verified", "Conflicts", "Website", "Phone", "Researched"].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-[#6E6E73]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} className="hover:bg-[#0A0A0A] cursor-pointer">
                  <td className="px-4 py-3">
                    <Link href={`/team/research/${r.id}`} className="text-[#F5F5F7] hover:underline">
                      {r.business_name || "Unidentified business"}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {r.identity_confidence && r.research_confidence_pct != null ? (
                      <span className="text-[12px] font-semibold" style={{ color: IDENTITY_COLOR[r.identity_confidence] ?? "#A1A1A6" }}>
                        {r.identity_confidence.replace("_", " ")}
                        {r.profile_type === "PERSONAL_PROFILE" && <span className="ml-1 text-[10.5px] font-normal text-[#6E6E73]">(personal profile)</span>}
                      </span>
                    ) : (
                      <span className="text-[#6E6E73]" title="Researched before the identity layer existed — open to see a derived profile">legacy</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[#A1A1A6]">
                    {r.research_confidence_pct != null ? `${r.research_confidence_pct}%` : r.research_completeness != null ? `${r.research_completeness}% (old)` : "—"}
                    {r.research_status === "completed_with_limitations" && <span className="ml-1 text-[10.5px] text-[#FFD60A]">limited</span>}
                  </td>
                  <td className="px-4 py-3 text-[#A1A1A6]">{r.fields_verified != null ? `${r.fields_verified}/${r.fields_total}` : "—"}</td>
                  <td className="px-4 py-3">{Array.isArray(r.conflicts) && r.conflicts.length > 0 ? <span className="text-[#FF9F0A]">{r.conflicts.length}</span> : <span className="text-[#6E6E73]">—</span>}</td>
                  <td className="px-4 py-3 text-[#A1A1A6]">{r.website?.replace(/^https?:\/\//, "") || "—"}</td>
                  <td className="px-4 py-3 text-[#A1A1A6]">{r.phone || "—"}</td>
                  <td className="px-4 py-3 text-[#6E6E73]">{new Date(r.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
