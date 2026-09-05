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
  created_at: string;
};

const STAGE_LABEL: Record<string, string> = {
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
  new: "#6E6E73",
  researching: "#FFD60A",
  ready_to_call: "#0A84FF",
  contacted: "#5E5CE6",
  qualified: "#30D158",
  proposal_sent: "#FF9F0A",
  won: "#30D158",
  lost: "#FF453A",
};

export default function LeadsList({ leads }: { leads: Lead[] }) {
  return (
    <div className="px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[20px] font-semibold text-[#F5F5F7]">Leads</div>
          <div className="text-[13px] text-[#6E6E73] mt-1">
            {leads.length} lead{leads.length === 1 ? "" : "s"}
          </div>
        </div>
        <Link
          href="/team/leads/import"
          className="h-[38px] px-4 inline-flex items-center gap-1.5 rounded-[8px] bg-white text-black text-[13px] font-semibold"
        >
          <Plus size={14} /> New Lead
        </Link>
      </div>

      {leads.length === 0 ? (
        <div
          className="rounded-[14px] p-10 text-center"
          style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div className="text-[14px] text-[#F5F5F7] font-medium mb-1.5">No leads yet</div>
          <div className="text-[13px] text-[#6E6E73] mb-5">
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
        <div className="rounded-[12px] overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ background: "#0A0A0A" }}>
                {["Business", "Location", "Stage", "AI Score", "Recommended Offer", "Added"].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-[#6E6E73]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr
                  key={l.id}
                  style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
                  className="hover:bg-[#0A0A0A] cursor-pointer"
                  onClick={() => (window.location.href = `/team/leads/${l.id}`)}
                >
                  <td className="px-4 py-3">
                    <div className="text-[#F5F5F7] font-medium">{l.business_name || "Unnamed lead"}</div>
                    <div className="text-[#6E6E73] text-[12px]">{l.website?.replace(/^https?:\/\//, "") || "—"}</div>
                  </td>
                  <td className="px-4 py-3 text-[#A1A1A6]">
                    {[l.city, l.state].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-[6px] h-[6px] rounded-full" style={{ background: STAGE_COLOR[l.pipeline_stage] || "#6E6E73" }} />
                      <span className="text-[#A1A1A6]">{STAGE_LABEL[l.pipeline_stage] || l.pipeline_stage}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#A1A1A6]">
                    {l.ai_overall_score !== null ? `${l.ai_overall_score}/100` : "—"}
                  </td>
                  <td className="px-4 py-3 text-[#A1A1A6] capitalize">
                    {l.recommended_offer ? l.recommended_offer.replace(/_/g, " ") : "—"}
                  </td>
                  <td className="px-4 py-3 text-[#6E6E73]">{new Date(l.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
