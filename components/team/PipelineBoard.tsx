"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Lead = {
  id: string;
  business_name: string | null;
  website: string | null;
  phone: string | null;
  pipeline_stage: string;
  recommended_offer: string | null;
  ai_overall_score: number | null;
  assigned_rep: string | null;
  updated_at: string;
};

const STAGES: { value: string; label: string }[] = [
  { value: "new", label: "New" },
  { value: "researching", label: "Researching" },
  { value: "ready_to_call", label: "Ready to Call" },
  { value: "contacted", label: "Contacted" },
  { value: "interested", label: "Interested" },
  { value: "follow_up", label: "Follow-Up" },
  { value: "meeting_booked", label: "Meeting Booked" },
  { value: "proposal", label: "Proposal" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "nurture", label: "Nurture" },
];

const OFFER_LABEL: Record<string, string> = {
  ai_presence: "AI Presence",
  website_new: "New Website",
  website_rebuild: "Website Rebuild",
  bingled: "Bingled",
  no_clear_opportunity: "No Clear Opportunity",
};

export default function PipelineBoard({ leads: initialLeads, repNames, isOwner }: { leads: Lead[]; repNames: Record<string, string>; isOwner: boolean }) {
  const router = useRouter();
  const [leads, setLeads] = useState(initialLeads);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  async function moveTo(leadId: string, stage: string) {
    const prev = leads;
    setLeads((cur) => cur.map((l) => (l.id === leadId ? { ...l, pipeline_stage: stage } : l)));
    try {
      const res = await fetch(`/api/team/leads/${leadId}/stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setLeads(prev); // revert on failure — never claim a move that didn't persist
    }
  }

  if (leads.length === 0) {
    return (
      <div className="px-8 py-8">
        <div className="rounded-[14px] p-10 text-center max-w-[480px] mx-auto" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="text-[15px] font-medium text-[#F5F5F7] mb-1.5">No leads yet</div>
          <p className="text-[13px] text-[#A1A1A6] mb-5">Research your first business to start filling the pipeline.</p>
          <Link href="/team/leads/import" className="inline-flex h-[38px] px-4 items-center rounded-[8px] bg-white text-black text-[12.5px] font-semibold">
            Research a Business
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="px-8 py-8">
      <div className="mb-6">
        <div className="text-[20px] font-semibold text-[#F5F5F7]">Pipeline</div>
        <div className="text-[13px] text-[#6E6E73] mt-1">Drag a card to move it between stages.</div>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {STAGES.map((stage) => {
          const cards = leads.filter((l) => l.pipeline_stage === stage.value);
          return (
            <div
              key={stage.value}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverStage(stage.value);
              }}
              onDragLeave={() => setDragOverStage((s) => (s === stage.value ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                const leadId = e.dataTransfer.getData("text/plain");
                setDragOverStage(null);
                if (leadId) moveTo(leadId, stage.value);
              }}
              className="w-[260px] shrink-0 rounded-[12px] p-2.5"
              style={{
                background: dragOverStage === stage.value ? "#111111" : "#0A0A0A",
                border: `1px solid ${dragOverStage === stage.value ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.08)"}`,
              }}
            >
              <div className="flex items-center justify-between px-1 mb-2">
                <span className="text-[11.5px] font-semibold uppercase tracking-wide text-[#6E6E73]">{stage.label}</span>
                <span className="text-[11px] text-[#6E6E73]">{cards.length}</span>
              </div>
              <div className="flex flex-col gap-2 min-h-[40px]">
                {cards.map((lead) => (
                  <div
                    key={lead.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", lead.id);
                      setDragging(lead.id);
                    }}
                    onDragEnd={() => setDragging(null)}
                    className="rounded-[9px] p-3 cursor-grab active:cursor-grabbing"
                    style={{
                      background: "#151515",
                      border: "1px solid rgba(255,255,255,0.08)",
                      opacity: dragging === lead.id ? 0.4 : 1,
                    }}
                  >
                    <Link href={`/team/leads/${lead.id}`} className="text-[13px] text-[#F5F5F7] font-medium hover:underline block truncate">
                      {lead.business_name || "Unnamed lead"}
                    </Link>
                    <div className="text-[11px] text-[#6E6E73] mt-0.5 truncate">{lead.phone || "No phone"}</div>
                    {lead.recommended_offer && (
                      <div className="text-[10.5px] text-[#0A84FF] mt-1.5">{OFFER_LABEL[lead.recommended_offer]}</div>
                    )}
                    {isOwner && lead.assigned_rep && (
                      <div className="text-[10.5px] text-[#6E6E73] mt-1">{repNames[lead.assigned_rep] || "Assigned"}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
