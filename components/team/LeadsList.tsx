"use client";

import Link from "next/link";
import { Plus } from "lucide-react";

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
};

const STAGE_LABEL: Record<string, string> = {
  demo_requested: "Book Demo (Pending)",
  new: "New",
  researching: "Researching",
  ready_to_call: "Ready to Call",
  contacted: "Contacted",
  qualified: "Qualified",
  proposal_sent: "Proposal Sent",
  won: "Won",
  lost: "Lost",
};

const STAGE_COLOR: Record<string, string> = {
  demo_requested: "var(--hx-ffd60a)",
  new: "var(--hx-6e6e73)",
  researching: "var(--hx-ffd60a)",
  ready_to_call: "var(--hx-0a84ff)",
  contacted: "var(--hx-5e5ce6)",
  qualified: "var(--hx-30d158)",
  proposal_sent: "var(--hx-ff9f0a)",
  won: "var(--hx-30d158)",
  lost: "var(--hx-ff453a)",
};

export default function LeadsList({ leads, showArchived }: { leads: Lead[]; showArchived: boolean }) {
  return (
    <div className="px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[20px] font-semibold text-[color:var(--hx-f5f5f7)]">Leads</div>
          <div className="text-[13px] text-[color:var(--hx-6e6e73)] mt-1">
            {leads.length} lead{leads.length === 1 ? "" : "s"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={showArchived ? "/team/leads" : "/team/leads?archived=1"}
            className="h-[38px] px-3.5 inline-flex items-center rounded-[8px] text-[12.5px] text-[color:var(--hx-a1a1a6)] hover:text-white"
            style={{ border: "1px solid rgb(var(--w) / 0.10)" }}
          >
            {showArchived ? "Hide Archived" : "Show Archived"}
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
          <div className="text-[14px] text-[color:var(--hx-f5f5f7)] font-medium mb-1.5">No leads yet</div>
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
                  onClick={() => (window.location.href = `/team/leads/${l.id}`)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[color:var(--hx-f5f5f7)] font-medium">{l.business_name || "Unnamed lead"}</span>
                      {l.archived && <span className="text-[10px] uppercase tracking-wide text-[color:var(--hx-6e6e73)] px-1.5 py-0.5 rounded-[4px]" style={{ border: "1px solid rgb(var(--w) / 0.15)" }}>Archived</span>}
                    </div>
                    <div className="text-[color:var(--hx-6e6e73)] text-[12px]">{l.website?.replace(/^https?:\/\//, "") || "—"}</div>
                  </td>
                  <td className="px-4 py-3 text-[color:var(--hx-a1a1a6)]">
                    {[l.city, l.state].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-[6px] h-[6px] rounded-full" style={{ background: STAGE_COLOR[l.pipeline_stage] || "var(--hx-6e6e73)" }} />
                      <span className="text-[color:var(--hx-a1a1a6)]">{STAGE_LABEL[l.pipeline_stage] || l.pipeline_stage}</span>
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
    </div>
  );
}
