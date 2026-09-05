"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Phone, Check, CalendarClock } from "lucide-react";

type Followup = { id: string; lead_id: string; due_at: string; reason: string | null; notes: string | null; status: string };
type Lead = { business_name: string | null; phone: string | null };

export default function FollowUpsList({ followups, leadMap }: { followups: Followup[]; leadMap: Record<string, Lead> }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [newDate, setNewDate] = useState("");

  async function complete(id: string) {
    setBusyId(id);
    try {
      await fetch(`/api/team/followups/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function reschedule(id: string) {
    if (!newDate) return;
    setBusyId(id);
    try {
      await fetch(`/api/team/followups/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dueAt: new Date(newDate).toISOString() }),
      });
      setReschedulingId(null);
      setNewDate("");
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  const now = new Date();
  const open = followups.filter((f) => f.status === "open");
  const overdue = open.filter((f) => new Date(f.due_at) < now);
  const today = open.filter((f) => {
    const d = new Date(f.due_at);
    return d >= now && d.toDateString() === now.toDateString();
  });
  const upcoming = open.filter((f) => new Date(f.due_at) > now && new Date(f.due_at).toDateString() !== now.toDateString());
  const completed = followups.filter((f) => f.status === "completed");

  if (followups.length === 0) {
    return (
      <div className="px-8 py-8">
        <div className="rounded-[14px] p-10 text-center max-w-[480px]" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="text-[15px] font-medium text-[#F5F5F7] mb-1.5">No follow-ups due</div>
          <p className="text-[13px] text-[#A1A1A6]">Follow-ups created from a call outcome will show up here.</p>
        </div>
      </div>
    );
  }

  const groups: [string, Followup[], string][] = [
    ["Overdue", overdue, "#FF453A"],
    ["Today", today, "#FFD60A"],
    ["Upcoming", upcoming, "#0A84FF"],
    ["Completed", completed, "#30D158"],
  ];

  return (
    <div className="px-8 py-8">
      <div className="mb-6">
        <div className="text-[20px] font-semibold text-[#F5F5F7]">Follow-Ups</div>
        <div className="text-[13px] text-[#6E6E73] mt-1">{open.length} open</div>
      </div>
      <div className="flex flex-col gap-8">
        {groups.map(([label, items, color]) =>
          items.length === 0 ? null : (
            <div key={label}>
              <div className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color }}>
                {label}
              </div>
              <div className="flex flex-col gap-2">
                {items.map((f) => {
                  const lead = leadMap[f.lead_id];
                  return (
                    <div key={f.id} className="p-4 rounded-[12px]" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <div className="flex items-center justify-between">
                        <div>
                          <Link href={`/team/leads/${f.lead_id}`} className="text-[13.5px] text-[#F5F5F7] hover:underline">
                            {lead?.business_name || "Unknown lead"}
                          </Link>
                          <div className="text-[12px] text-[#6E6E73] mt-0.5">
                            {f.reason || "Follow up"} — {new Date(f.due_at).toLocaleString()}
                          </div>
                        </div>
                        {f.status === "open" && (
                          <div className="flex items-center gap-1.5">
                            {lead?.phone && (
                              <a href={`tel:${lead.phone.replace(/[^\d+]/g, "")}`} className="p-1.5 rounded-[6px] text-[#6E6E73] hover:text-white hover:bg-[#151515]" title="Call now">
                                <Phone size={14} />
                              </a>
                            )}
                            <button
                              onClick={() => setReschedulingId(reschedulingId === f.id ? null : f.id)}
                              className="p-1.5 rounded-[6px] text-[#6E6E73] hover:text-white hover:bg-[#151515]"
                              title="Reschedule"
                            >
                              <CalendarClock size={14} />
                            </button>
                            <button
                              disabled={busyId === f.id}
                              onClick={() => complete(f.id)}
                              className="p-1.5 rounded-[6px] text-[#6E6E73] hover:text-white hover:bg-[#151515]"
                              title="Complete"
                            >
                              <Check size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                      {reschedulingId === f.id && (
                        <div className="flex items-center gap-2 mt-3">
                          <input
                            type="datetime-local"
                            value={newDate}
                            onChange={(e) => setNewDate(e.target.value)}
                            className="h-[34px] rounded-[7px] px-2.5 text-[12.5px] outline-none"
                            style={{ background: "#101010", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" }}
                          />
                          <button onClick={() => reschedule(f.id)} className="h-[34px] px-3 rounded-[7px] bg-white text-black text-[12px] font-semibold">
                            Save
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
