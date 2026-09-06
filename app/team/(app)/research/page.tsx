import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ResearchQueuePage() {
  const supabase = createSupabaseServerClient();

  const { data: results } = await supabase
    .from("crm_research_results")
    .select("id, business_name, website, phone, category, research_completeness, status, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

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
                {["Business", "Website", "Phone", "Category", "Completeness", "Researched"].map((h) => (
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
                  <td className="px-4 py-3 text-[#A1A1A6]">{r.website?.replace(/^https?:\/\//, "") || "—"}</td>
                  <td className="px-4 py-3 text-[#A1A1A6]">{r.phone || "—"}</td>
                  <td className="px-4 py-3 text-[#A1A1A6]">{r.category || "—"}</td>
                  <td className="px-4 py-3 text-[#A1A1A6]">{r.research_completeness != null ? `${r.research_completeness}%` : "—"}</td>
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
