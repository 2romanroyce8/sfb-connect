"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { STAGE_COLOR, stageLabel, PIPELINE_STAGES } from "@/lib/crm/stages";
import { useMultiSelect, SelectCircle, SelectToggle, BulkBar, postJson } from "@/components/ui/MultiSelect";
import { plural } from "@/lib/ui/selection";
import { Plus, Upload, X } from "lucide-react";
import LeadTags from "@/components/team/LeadTags";

type Lead = {
  id: string;
  business_name: string | null;
  website: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  pipeline_stage: string;
  ai_overall_score: number | null;
  recommended_offer: string | null;
  archived: boolean;
  created_at: string;
  tags?: string[] | null;
};



export default function LeadsList({ leads, showArchived, activeTag = null, isOwner = false, reps = [] }: { leads: Lead[]; showArchived: boolean; activeTag?: string | null; isOwner?: boolean; reps?: { id: string; label: string }[] }) {
  const router = useRouter();
  const ms = useMultiSelect(leads.map((l) => l.id));
  const noun = (n: number) => plural(n, "lead");
  const bulk = async (body: Record<string, unknown>) => { const j = await postJson("/api/team/leads/bulk", body); router.refresh(); return j; };
  const actions = [
    { label: "Change stage", options: PIPELINE_STAGES.filter((s) => s.manual && s.value !== "won").map((s) => ({ label: s.label, value: s.value })), confirm: (n: number) => `Move ${noun(n)}?`, run: async (ids: string[], v?: string) => { const j = await bulk({ action: "stage", ids, stage: v }); return `${noun(j.count)} moved to ${stageLabel(v)}${j.unchanged ? ` · ${j.unchanged} already there` : ""}`; } },
    ...(isOwner ? [{ label: "Assign", options: [...reps.map((r) => ({ label: r.label, value: r.id })), { label: "Unassigned", value: "" }], confirm: (n: number) => `Reassign ${noun(n)}?`, run: async (ids: string[], v?: string) => { const j = await bulk({ action: "assign", ids, rep_id: v || null }); return `${noun(j.count)} reassigned to ${reps.find((r) => r.id === v)?.label ?? "nobody"}`; } }] : []),
    ...(!showArchived ? [{ label: "Archive", tone: "danger" as const, confirm: (n: number) => `Archive ${noun(n)}?`, run: async (ids: string[]) => { const j = await bulk({ action: "archive", ids }); return `${noun(j.count)} archived`; } }] : []),
  ];
  const tagQuery = activeTag ? `tag=${encodeURIComponent(activeTag)}` : "";
  return (
    <div className="px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[20px] font-semibold text-[color:var(--hx-f5f5f7)]">Leads</div>
          <div className="text-[13px] text-[color:var(--hx-6e6e73)] mt-1">
            {leads.length} lead{leads.length === 1 ? "" : "s"}
            {activeTag && <> tagged <span className="text-[color:var(--hx-f5f5f7)] font-medium">{activeTag}</span></>}
          </div>
          {activeTag && (
            <Link
              href={showArchived ? "/team/leads?archived=1" : "/team/leads"}
              className="mt-2 inline-flex items-center gap-1 text-[12px] text-[color:var(--hx-a1a1a6)] hover:text-white"
            >
              <X size={12} /> Clear tag filter
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2">
          <SelectToggle ms={ms} total={leads.length} noun="leads" />
          <Link
            href={showArchived ? `/team/leads${tagQuery ? `?${tagQuery}` : ""}` : `/team/leads?archived=1${tagQuery ? `&${tagQuery}` : ""}`}
            className="h-[38px] px-3.5 inline-flex items-center rounded-[8px] text-[12.5px] text-[color:var(--hx-a1a1a6)] hover:text-white"
            style={{ border: "1px solid rgb(var(--w) / 0.10)" }}
          >
            {showArchived ? "Hide Archived" : "Show Archived"}
          </Link>
          <Link
            href="/team/leads/import-csv"
            className="h-[38px] px-3.5 inline-flex items-center gap-1.5 rounded-[8px] text-[12.5px] text-[color:var(--hx-f5f5f7)]"
            style={{ border: "1px solid rgb(var(--w) / 0.14)" }}
          >
            <Upload size={14} /> Upload CSV
          </Link>
          <Link
            href="/team/leads/import"
            className="h-[38px] px-4 inline-flex items-center gap-1.5 rounded-[8px] bg-white text-black text-[13px] font-semibold"
          >
            <Plus size={14} /> New Lead
          </Link>
        </div>
      </div>

      {leads.length === 0 ? (
        <div
          className="rounded-[14px] p-10 text-center"
          style={{ background: "var(--hx-0a0a0a)", border: "1px solid rgb(var(--w) / 0.08)" }}
        >
          <div className="text-[14px] text-[color:var(--hx-f5f5f7)] font-medium mb-1.5">{activeTag ? `No leads tagged ${activeTag}` : "No leads yet"}</div>
          <div className="text-[13px] text-[color:var(--hx-6e6e73)] mb-5">
            Import a business by URL to start the research pipeline.
          </div>
          <Link
            href="/team/leads/import"
            className="h-[38px] px-4 inline-flex items-center gap-1.5 rounded-[8px] bg-white text-black text-[13px] font-semibold"
          >
            <Plus size={14} /> Research a Business
          </Link>
        </div>
      ) : (
        <div className="rounded-[12px] overflow-hidden" style={{ border: "1px solid rgb(var(--w) / 0.08)" }}>
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ background: "var(--hx-0a0a0a)" }}>
                {ms.active && <th className="w-[44px] pl-3" />}
                {["Business", "Location", "Stage", "AI Score", "Recommended Offer", "Added"].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--hx-6e6e73)]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr
                  key={l.id}
                  style={{ borderTop: "1px solid rgb(var(--w) / 0.06)" }}
                  className="hover:bg-[color:var(--hx-0a0a0a)] cursor-pointer"
                  onClick={() => router.push(`/team/leads/${l.id}`)}
                  data-selected={ms.isSelected(l.id) || undefined}
                  onMouseEnter={() => router.prefetch(`/team/leads/${l.id}`)}
                >
                  {ms.active && <td className="pl-3 w-[44px]"><SelectCircle checked={ms.isSelected(l.id)} onToggle={() => ms.toggle(l.id)} label={`Select ${l.business_name ?? "lead"}`} /></td>}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[color:var(--hx-f5f5f7)] font-medium">{l.business_name || "Unnamed lead"}</span>
                      {l.archived && <span className="text-[10px] uppercase tracking-wide text-[color:var(--hx-6e6e73)] px-1.5 py-0.5 rounded-[4px]" style={{ border: "1px solid rgb(var(--w) / 0.15)" }}>Archived</span>}
                    </div>
                    <div className="text-[color:var(--hx-6e6e73)] text-[12px]">{l.website?.replace(/^https?:\/\//, "") || "—"}</div>
                    {l.tags && l.tags.length > 0 && (
                      <div className="mt-1.5">
                        <LeadTags tags={l.tags} linkTags activeTag={activeTag} />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[color:var(--hx-a1a1a6)]">
                    {[l.city, l.state].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-[6px] h-[6px] rounded-full" style={{ background: STAGE_COLOR[l.pipeline_stage] || "var(--hx-6e6e73)" }} />
                      <span className="text-[color:var(--hx-a1a1a6)]">{stageLabel(l.pipeline_stage)}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[color:var(--hx-a1a1a6)]">
                    {l.ai_overall_score !== null ? `${l.ai_overall_score}/100` : "—"}
                  </td>
                  <td className="px-4 py-3 text-[color:var(--hx-a1a1a6)] capitalize">
                    {l.recommended_offer ? l.recommended_offer.replace(/_/g, " ") : "—"}
                  </td>
                  <td className="px-4 py-3 text-[color:var(--hx-6e6e73)]">{new Date(l.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <BulkBar ms={ms} noun={noun} actions={actions} />
      {ms.active && <div className="h-[96px]" />}
    </div>
  );
}
