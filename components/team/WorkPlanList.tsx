"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, X, Loader2 } from "lucide-react";

type Plan = { id: string; name: string; plan_type: string; start_date: string; end_date: string; status: string; related_lead_id: string | null };

const TYPE_LABEL: Record<string, string> = {
  sales_os_build: "SFB Sales OS Build",
  website_project: "Website Client Project",
  ai_presence_delivery: "AI Presence Client Delivery",
  automation_project: "Automation Project",
  marketing_campaign: "Marketing Campaign",
  internal_roadmap: "Internal Product Roadmap",
};

const STATUS_COLOR: Record<string, string> = { not_started: "#6E6E73", in_progress: "#0A84FF", blocked: "#FF453A", complete: "#30D158" };

export default function WorkPlanList({ plans, progressByPlan, isOwner }: { plans: Plan[]; progressByPlan: Record<string, { total: number; complete: number }>; isOwner: boolean }) {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[20px] font-semibold text-[#F5F5F7]">Work Plan</div>
          <div className="text-[13px] text-[#6E6E73] mt-1">Execution and delivery timelines — separate from the sales pipeline.</div>
        </div>
        {isOwner && (
          <button onClick={() => setShowCreate(true)} className="h-[38px] px-4 inline-flex items-center gap-1.5 rounded-[8px] bg-white text-black text-[13px] font-semibold">
            <Plus size={14} /> New Plan
          </button>
        )}
      </div>

      {plans.length === 0 ? (
        <div className="rounded-[14px] p-10 text-center max-w-[480px]" style={{ background: "#111111", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="text-[15px] font-medium text-[#F5F5F7] mb-1.5">No work plans yet</div>
          <p className="text-[13px] text-[#A1A1A6]">{isOwner ? "Create a plan for a delivery project or internal build." : "You'll see plans here once you're assigned to one."}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {plans.map((p) => {
            const progress = progressByPlan[p.id];
            const pct = progress && progress.total > 0 ? Math.round((progress.complete / progress.total) * 100) : 0;
            return (
              <Link key={p.id} href={`/team/work-plan/${p.id}`} className="rounded-[12px] p-5" style={{ background: "#111111", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[15px] font-medium text-[#F5F5F7]">{p.name}</span>
                  <span className="inline-flex items-center gap-1.5 text-[11px] capitalize" style={{ color: STATUS_COLOR[p.status] }}>
                    <span className="w-[6px] h-[6px] rounded-full" style={{ background: STATUS_COLOR[p.status] }} />
                    {p.status.replace(/_/g, " ")}
                  </span>
                </div>
                <div className="text-[12px] text-[#767676] mb-3">{TYPE_LABEL[p.plan_type] || p.plan_type}</div>
                <div className="text-[11.5px] text-[#A1A1A6] mb-2">
                  {new Date(p.start_date).toLocaleDateString()} – {new Date(p.end_date).toLocaleDateString()}
                </div>
                {progress && progress.total > 0 && (
                  <div className="h-[4px] rounded-full overflow-hidden" style={{ background: "#1D1D1D" }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "#20C7B7" }} />
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}

      {showCreate && <CreatePlanModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function CreatePlanModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [planType, setPlanType] = useState("internal_roadmap");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim() || !startDate || !endDate) {
      setError("Name, start date, and end date are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/team/work-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, planType, startDate, endDate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push(`/team/work-plan/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create plan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div className="w-[420px] rounded-[14px] p-6" style={{ background: "#111111", border: "1px solid rgba(255,255,255,0.08)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="text-[15px] font-semibold text-[#F5F5F7]">New Work Plan</div>
          <button onClick={onClose} className="text-[#6E6E73] hover:text-white">
            <X size={16} />
          </button>
        </div>
        <div className="flex flex-col gap-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Plan name" className="h-[38px] rounded-[8px] px-3 text-[13px] outline-none" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" }} />
          <select value={planType} onChange={(e) => setPlanType(e.target.value)} className="h-[38px] rounded-[8px] px-3 text-[13px] outline-none" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" }}>
            {Object.entries(TYPE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-[38px] rounded-[8px] px-3 text-[13px] outline-none" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" }} />
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-[38px] rounded-[8px] px-3 text-[13px] outline-none" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" }} />
          </div>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" className="h-[70px] resize-none rounded-[8px] p-2.5 text-[13px] outline-none" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" }} />
          {error && <p className="text-[12.5px] text-[#FF453A]">{error}</p>}
          <button onClick={submit} disabled={saving} className="h-[40px] rounded-[8px] bg-white text-black text-[13px] font-semibold disabled:opacity-60 flex items-center justify-center gap-1.5">
            {saving ? <Loader2 size={14} className="animate-spin" /> : null} {saving ? "Creating…" : "Create Plan"}
          </button>
        </div>
      </div>
    </div>
  );
}
