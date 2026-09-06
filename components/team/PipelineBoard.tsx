"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LayoutGrid, ListFilter, ArrowUpDown, StickyNote, Link2 } from "lucide-react";

type Lead = {
  id: string;
  business_name: string | null;
  website: string | null;
  phone: string | null;
  category: string | null;
  pipeline_stage: string;
  recommended_offer: string | null;
  ai_overall_score: number | null;
  assigned_rep: string | null;
  updated_at: string;
};

const STAGES: { value: string; label: string; color: string }[] = [
  { value: "new", label: "New", color: "#46B5FF" },
  { value: "researching", label: "Researching", color: "#6E7BFF" },
  { value: "ready_to_call", label: "Ready to Call", color: "#30D158" },
  { value: "contacted", label: "Contacted", color: "#20C7B7" },
  { value: "interested", label: "Interested", color: "#5AC8FA" },
  { value: "follow_up", label: "Follow-Up", color: "#FF9F0A" },
  { value: "meeting_booked", label: "Meeting Booked", color: "#BF5AF2" },
  { value: "proposal", label: "Proposal", color: "#FF9F0A" },
  { value: "won", label: "Won", color: "#30D158" },
  { value: "lost", label: "Lost", color: "#FF453A" },
  { value: "nurture", label: "Nurture", color: "#6E6E73" },
];

const OFFER_LABEL: Record<string, string> = {
  ai_presence: "AI Presence",
  website_new: "New Website",
  website_rebuild: "Website Rebuild",
  bingled: "Bingled",
  no_clear_opportunity: "No Clear Opportunity",
};

// Priority is derived, never fabricated -- it's the same AI Presence score
// used everywhere else in the CRM to rank "next best lead", just surfaced
// here as a visual strip instead of a raw number.
function priorityFor(score: number | null): { label: string; color: string } {
  if (score == null) return { label: "UNSCORED", color: "#6E6E73" };
  if (score >= 80) return { label: "URGENT", color: "#FF4D4D" };
  if (score >= 60) return { label: "HIGH", color: "#FF9F0A" };
  if (score >= 30) return { label: "NORMAL", color: "#46B5FF" };
  return { label: "LOW", color: "#3CBF73" };
}

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const SORTS = [
  { key: "newest", label: "Newest" },
  { key: "oldest", label: "Oldest" },
  { key: "priority", label: "Highest Priority" },
  { key: "activity", label: "Most Recent Activity" },
];

export default function PipelineBoard({
  leads: initialLeads,
  repNames,
  isOwner,
  noteCounts,
  sourceCounts,
}: {
  leads: Lead[];
  repNames: Record<string, string>;
  isOwner: boolean;
  noteCounts: Record<string, number>;
  sourceCounts: Record<string, number>;
}) {
  const router = useRouter();
  const [leads, setLeads] = useState(initialLeads);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [repFilter, setRepFilter] = useState("");
  const [sort, setSort] = useState("newest");
  const [showFilter, setShowFilter] = useState(false);
  const [showSort, setShowSort] = useState(false);

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

  const filtered = useMemo(() => (repFilter ? leads.filter((l) => l.assigned_rep === repFilter) : leads), [leads, repFilter]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    switch (sort) {
      case "oldest":
        return list.sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime());
      case "priority":
        return list.sort((a, b) => (b.ai_overall_score ?? -1) - (a.ai_overall_score ?? -1));
      case "activity":
        return list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      default:
        return list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    }
  }, [filtered, sort]);

  if (leads.length === 0) {
    return (
      <div className="px-8 py-8">
        <div className="rounded-[14px] p-10 text-center max-w-[480px] mx-auto" style={{ background: "#111111", border: "1px solid rgba(255,255,255,0.06)" }}>
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
    <div className="px-6 py-6" style={{ background: "#0A0A0A", minHeight: "100vh" }}>
      {/* toolbar */}
      <div className="inline-flex items-center rounded-[14px] overflow-hidden mb-5" style={{ background: "#111111", border: "1px solid rgba(255,255,255,0.07)", boxShadow: "0 8px 24px rgba(0,0,0,0.18)" }}>
        <div className="h-[46px] px-5 flex items-center gap-2" style={{ background: "#1B1B1B", color: "#F3F3F3", borderRight: "1px solid rgba(255,255,255,0.05)" }}>
          <LayoutGrid size={16} color="#30D158" /> <span className="text-[13.5px] font-medium">Pipeline view</span>
        </div>
        <div className="relative">
          <button onClick={() => { setShowFilter((v) => !v); setShowSort(false); }} className="h-[46px] px-5 flex items-center gap-2 text-[13.5px]" style={{ color: repFilter ? "#F3F3F3" : "#AFAFAF", borderRight: "1px solid rgba(255,255,255,0.05)" }}>
            <ListFilter size={16} /> Filter{repFilter ? `: ${repNames[repFilter] || "Rep"}` : ""}
          </button>
          {showFilter && (
            <div className="absolute left-0 mt-1 z-20 rounded-[10px] p-1.5" style={{ background: "#1B1B1B", border: "1px solid rgba(255,255,255,0.1)", width: 200 }}>
              <button onClick={() => { setRepFilter(""); setShowFilter(false); }} className="w-full text-left px-2.5 py-2 rounded-[6px] text-[12.5px] text-[#A1A1A6] hover:bg-[#252525]">
                All Reps
              </button>
              {isOwner &&
                Object.entries(repNames).map(([id, name]) => (
                  <button key={id} onClick={() => { setRepFilter(id); setShowFilter(false); }} className="w-full text-left px-2.5 py-2 rounded-[6px] text-[12.5px] text-[#A1A1A6] hover:bg-[#252525]">
                    {name}
                  </button>
                ))}
            </div>
          )}
        </div>
        <div className="relative">
          <button onClick={() => { setShowSort((v) => !v); setShowFilter(false); }} className="h-[46px] px-5 flex items-center gap-2 text-[13.5px]" style={{ color: "#AFAFAF" }}>
            <ArrowUpDown size={16} /> Sort: {SORTS.find((s) => s.key === sort)?.label}
          </button>
          {showSort && (
            <div className="absolute left-0 mt-1 z-20 rounded-[10px] p-1.5" style={{ background: "#1B1B1B", border: "1px solid rgba(255,255,255,0.1)", width: 200 }}>
              {SORTS.map((s) => (
                <button key={s.key} onClick={() => { setSort(s.key); setShowSort(false); }} className="w-full text-left px-2.5 py-2 rounded-[6px] text-[12.5px] text-[#A1A1A6] hover:bg-[#252525]">
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-5 overflow-x-auto pb-4">
        {STAGES.map((stage) => {
          const cards = sorted.filter((l) => l.pipeline_stage === stage.value);
          const latestUpdate = cards.length > 0 ? cards.reduce((max, c) => (new Date(c.updated_at) > new Date(max) ? c.updated_at : max), cards[0].updated_at) : null;
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
              className="w-[300px] shrink-0"
              style={{ background: dragOverStage === stage.value ? "#141414" : "transparent", borderRadius: 12 }}
            >
              <div className="flex items-center gap-2.5 px-2 mb-1">
                <span className="rounded-full" style={{ width: 6, height: 22, background: stage.color }} />
                <span className="text-[15px] font-medium uppercase tracking-tight text-[#F5F5F7]">{stage.label}</span>
              </div>
              <div className="flex items-center justify-between px-2 mb-3">
                <span className="text-[12px] text-[#B6B6B6]">{cards.length} lead{cards.length === 1 ? "" : "s"}</span>
                {latestUpdate && <span className="text-[11.5px] text-[#A2A2A2]">Updated {timeAgo(latestUpdate)}</span>}
              </div>

              <div className="flex flex-col gap-2.5 min-h-[40px] px-1">
                {cards.map((lead) => {
                  const priority = priorityFor(lead.ai_overall_score);
                  return (
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", lead.id);
                        setDragging(lead.id);
                      }}
                      onDragEnd={() => setDragging(null)}
                      className="rounded-[14px] overflow-hidden cursor-grab active:cursor-grabbing"
                      style={{ background: "#151515", border: "1px solid rgba(255,255,255,0.055)", opacity: dragging === lead.id ? 0.4 : 1, boxShadow: "0 10px 26px rgba(0,0,0,0.18)" }}
                    >
                      <div className="h-[26px] flex items-center justify-center text-[11px] font-semibold uppercase tracking-wide" style={{ background: priority.color, color: "#FFFFFF" }}>
                        {priority.label}
                      </div>
                      <div className="m-2 p-3 rounded-[10px]" style={{ border: "1px dashed rgba(255,255,255,0.16)" }}>
                        <Link href={`/team/leads/${lead.id}`} className="text-[14.5px] font-medium text-[#F5F5F7] hover:underline block truncate">
                          {lead.business_name || "Unnamed lead"}
                        </Link>
                        {lead.category && <div className="text-[11.5px] text-[#A4A4A4] mt-1 truncate">{lead.category}</div>}

                        <div className="flex items-center justify-between mt-3">
                          <div className="w-6 h-6 rounded-full bg-white text-black flex items-center justify-center text-[10px] font-bold">
                            {isOwner && lead.assigned_rep ? (repNames[lead.assigned_rep] || "?").slice(0, 1).toUpperCase() : (lead.business_name || "?").slice(0, 1).toUpperCase()}
                          </div>
                          {lead.recommended_offer && (
                            <span className="text-[10.5px] px-2 py-1 rounded-[6px]" style={{ background: "#2D2D2D", color: "#F2F2F2" }}>
                              {OFFER_LABEL[lead.recommended_offer]}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 px-3 pb-2.5 text-[11px] text-[#C6C6C6]">
                        <span className="flex items-center gap-1">
                          <StickyNote size={12} /> {noteCounts[lead.id] || 0}
                        </span>
                        <span className="flex items-center gap-1">
                          <Link2 size={12} /> {sourceCounts[lead.id] || 0}
                        </span>
                        <span className="ml-auto text-[#C9C9C9]">{timeAgo(lead.updated_at)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
