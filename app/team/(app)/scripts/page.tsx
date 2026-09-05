import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const OFFER_LABEL: Record<string, string> = {
  ai_presence: "AI Presence",
  website_new: "New Website",
  website_rebuild: "Website Rebuild",
  bingled: "Bingled",
  no_clear_opportunity: "No Clear Opportunity",
};

export default async function ScriptsPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: caller } = await supabase.from("users").select("team_role").eq("id", user!.id).single();
  const isOwner = caller?.team_role === "owner";

  const { data: scripts } = await supabase
    .from("crm_scripts")
    .select("id, lead_id, variant_type, created_by, created_at")
    .order("created_at", { ascending: false });

  const leadIds = Array.from(new Set((scripts ?? []).map((s) => s.lead_id)));
  const repIds = Array.from(new Set((scripts ?? []).map((s) => s.created_by).filter(Boolean)));
  const [{ data: leads }, { data: reps }] = await Promise.all([
    leadIds.length ? supabase.from("crm_leads").select("id, business_name, recommended_offer").in("id", leadIds) : Promise.resolve({ data: [] as any[] }),
    isOwner && repIds.length ? supabase.from("users").select("id, full_name, email").in("id", repIds) : Promise.resolve({ data: [] as any[] }),
  ]);
  const leadMap = Object.fromEntries((leads ?? []).map((l) => [l.id, l]));
  const repMap = Object.fromEntries((reps ?? []).map((r) => [r.id, r.full_name || r.email]));

  // Group by lead, keep versions ordered newest-first, count as "Version N"
  const versionCounts = new Map<string, number>();

  return (
    <div className="px-8 py-8">
      <div className="mb-6">
        <div className="text-[20px] font-semibold text-[#F5F5F7]">Scripts</div>
        <div className="text-[13px] text-[#6E6E73] mt-1">{(scripts ?? []).length} generated</div>
      </div>

      {!scripts || scripts.length === 0 ? (
        <div className="rounded-[14px] p-10 text-center max-w-[520px]" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="text-[15px] font-medium text-[#F5F5F7] mb-1.5">No scripts yet</div>
          <p className="text-[13px] text-[#A1A1A6]">Generate a call script from a lead's audit — it'll show up here.</p>
        </div>
      ) : (
        <div className="rounded-[12px] overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ background: "#0A0A0A" }}>
                {["Business", "Offer", ...(isOwner ? ["Rep"] : []), "Variant", "Created"].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-[#6E6E73]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...scripts]
                .reverse()
                .map((s) => {
                  const count = (versionCounts.get(s.lead_id) || 0) + 1;
                  versionCounts.set(s.lead_id, count);
                  return { ...s, version: count };
                })
                .reverse()
                .map((s) => (
                  <tr key={s.id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <td className="px-4 py-3">
                      <Link href={`/team/leads/${s.lead_id}/script`} className="text-[#F5F5F7] hover:underline">
                        {leadMap[s.lead_id]?.business_name || "Unknown lead"}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[#A1A1A6]">{OFFER_LABEL[leadMap[s.lead_id]?.recommended_offer] || "—"}</td>
                    {isOwner && <td className="px-4 py-3 text-[#A1A1A6]">{s.created_by ? repMap[s.created_by] || "—" : "—"}</td>}
                    <td className="px-4 py-3 text-[#A1A1A6] capitalize">{s.variant_type}</td>
                    <td className="px-4 py-3 text-[#6E6E73]">v{s.version} · {new Date(s.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
