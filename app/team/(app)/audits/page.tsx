import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AuditsPage() {
  const supabase = createSupabaseServerClient();

  const { data: audits } = await supabase
    .from("crm_audits")
    .select("id, lead_id, overall_score, identity_score, knowledge_score, authority_score, location_score, machine_readability_score, created_at")
    .order("created_at", { ascending: false });

  // Keep only the most recent audit per lead — older regenerations stay in
  // history but shouldn't clutter this list.
  type AuditRow = NonNullable<typeof audits>[number];
  const latestByLead = new Map<string, AuditRow>();
  for (const a of audits ?? []) {
    if (!latestByLead.has(a.lead_id)) latestByLead.set(a.lead_id, a);
  }
  const rows = Array.from(latestByLead.values());

  const leadIds = rows.map((r) => r.lead_id);
  const { data: leads } = leadIds.length ? await supabase.from("crm_leads").select("id, business_name, website").in("id", leadIds) : { data: [] as any[] };
  const leadMap = Object.fromEntries((leads ?? []).map((l) => [l.id, l]));

  return (
    <div className="px-8 py-8">
      <div className="mb-6">
        <div className="text-[20px] font-semibold text-[#F5F5F7]">Business Audits</div>
        <div className="text-[13px] text-[#6E6E73] mt-1">{rows.length} audited lead{rows.length === 1 ? "" : "s"}</div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-[14px] p-10 text-center max-w-[520px]" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="text-[15px] font-medium text-[#F5F5F7] mb-1.5">No audits yet</div>
          <p className="text-[13px] text-[#A1A1A6]">
            Open a researched lead and generate its AI Presence Audit — it'll show up here.
          </p>
        </div>
      ) : (
        <div className="rounded-[12px] overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ background: "#0A0A0A" }}>
                {["Business", "Overall", "Identity", "Knowledge", "Authority", "Location", "Machine Read.", "Last Audited"].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-[#6E6E73]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <td className="px-4 py-3">
                    <Link href={`/team/leads/${a.lead_id}/audit`} className="text-[#F5F5F7] hover:underline">
                      {leadMap[a.lead_id]?.business_name || "Unknown lead"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[#F5F5F7] font-medium">{a.overall_score}/100</td>
                  <td className="px-4 py-3 text-[#A1A1A6]">{a.identity_score}</td>
                  <td className="px-4 py-3 text-[#A1A1A6]">{a.knowledge_score}</td>
                  <td className="px-4 py-3 text-[#A1A1A6]">{a.authority_score}</td>
                  <td className="px-4 py-3 text-[#A1A1A6]">{a.location_score}</td>
                  <td className="px-4 py-3 text-[#A1A1A6]">{a.machine_readability_score}</td>
                  <td className="px-4 py-3 text-[#6E6E73]">{new Date(a.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
