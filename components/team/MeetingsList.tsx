"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Video, CalendarClock, X, Check, UserX, RotateCcw } from "lucide-react";

type Meeting = {
  id: string;
  lead_id: string;
  rep_id: string;
  scheduled_at: string;
  ends_at: string | null;
  contact_name: string | null;
  contact_email: string | null;
  google_meet_url: string | null;
  status: string;
};
type Lead = { business_name: string | null; phone: string | null };

export default function MeetingsList({
  meetings,
  leadMap,
  repMap,
  isOwner,
}: {
  meetings: Meeting[];
  leadMap: Record<string, Lead>;
  repMap: Record<string, string>;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function outcome(id: string, value: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/team/meetings/${id}/outcome`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome: value }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update.");
    } finally {
      setBusyId(null);
    }
  }

  async function cancel(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/team/meetings/${id}/cancel`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel.");
    } finally {
      setBusyId(null);
    }
  }

  async function reschedule(id: string) {
    if (!newDate || !newTime) return;
    setBusyId(id);
    setError(null);
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const startISO = new Date(`${newDate}T${newTime}:00`).toISOString();
      const endISO = new Date(new Date(startISO).getTime() + 30 * 60000).toISOString();
      const res = await fetch(`/api/team/meetings/${id}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startISO, endISO, timeZone }),
      });
      if (!res.ok) throw new Error((await res.json()).message || (await res.json()).error);
      setReschedulingId(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reschedule.");
    } finally {
      setBusyId(null);
    }
  }

  if (meetings.length === 0) {
    return (
      <div className="px-8 py-8">
        <div className="rounded-[14px] p-10 text-center max-w-[480px]" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="text-[15px] font-medium text-[#F5F5F7] mb-1.5">No meetings booked</div>
          <p className="text-[13px] text-[#A1A1A6]">Booking a meeting from a call's outcome sheet will list it here.</p>
        </div>
      </div>
    );
  }

  const now = new Date();
  const upcoming = meetings.filter((m) => m.status === "booked" && new Date(m.scheduled_at) >= now);
  const past = meetings.filter((m) => m.status !== "booked" || new Date(m.scheduled_at) < now);

  return (
    <div className="px-8 py-8">
      <div className="mb-6">
        <div className="text-[20px] font-semibold text-[#F5F5F7]">Meetings</div>
        <div className="text-[13px] text-[#6E6E73] mt-1">{upcoming.length} upcoming</div>
      </div>
      {error && <p className="text-[12.5px] text-[#FF453A] mb-4">{error}</p>}

      <div className="flex flex-col gap-8">
        {[
          ["Upcoming", upcoming],
          ["Past / Other", past],
        ].map(([title, list]) =>
          (list as Meeting[]).length === 0 ? null : (
            <div key={title as string}>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[#6E6E73] mb-2">{title as string}</div>
              <div className="flex flex-col gap-2 max-w-[720px]">
                {(list as Meeting[]).map((m) => {
                  const lead = leadMap[m.lead_id];
                  const isPast = new Date(m.scheduled_at) < now;
                  return (
                    <div key={m.id} className="p-4 rounded-[12px]" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <div className="flex items-center justify-between">
                        <div>
                          <Link href={`/team/leads/${m.lead_id}`} className="text-[13.5px] text-[#F5F5F7] hover:underline">
                            {lead?.business_name || "Unknown lead"}
                          </Link>
                          <div className="text-[12px] text-[#6E6E73] mt-0.5">
                            {new Date(m.scheduled_at).toLocaleString()} {isOwner && repMap[m.rep_id] ? `· ${repMap[m.rep_id]}` : ""} · <span className="capitalize">{m.status}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {m.google_meet_url && m.status === "booked" && (
                            <a href={m.google_meet_url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-[6px] text-[#0A84FF] hover:bg-[#151515]" title="Join Meeting">
                              <Video size={14} />
                            </a>
                          )}
                          {m.status === "booked" && (
                            <>
                              <button disabled={busyId === m.id} onClick={() => setReschedulingId(reschedulingId === m.id ? null : m.id)} className="p-1.5 rounded-[6px] text-[#6E6E73] hover:text-white hover:bg-[#151515]" title="Reschedule">
                                <CalendarClock size={14} />
                              </button>
                              <button disabled={busyId === m.id} onClick={() => cancel(m.id)} className="p-1.5 rounded-[6px] text-[#6E6E73] hover:text-white hover:bg-[#151515]" title="Cancel">
                                <X size={14} />
                              </button>
                              {isPast && (
                                <>
                                  <button disabled={busyId === m.id} onClick={() => outcome(m.id, "completed")} className="p-1.5 rounded-[6px] text-[#30D158] hover:bg-[#151515]" title="Completed">
                                    <Check size={14} />
                                  </button>
                                  <button disabled={busyId === m.id} onClick={() => outcome(m.id, "no_show")} className="p-1.5 rounded-[6px] text-[#FF9F0A] hover:bg-[#151515]" title="No-Show">
                                    <UserX size={14} />
                                  </button>
                                </>
                              )}
                            </>
                          )}
                          {(m.status === "no_show" || m.status === "cancelled") && (
                            <button disabled={busyId === m.id} onClick={() => setReschedulingId(reschedulingId === m.id ? null : m.id)} className="p-1.5 rounded-[6px] text-[#6E6E73] hover:text-white hover:bg-[#151515]" title="Reschedule">
                              <RotateCcw size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                      {reschedulingId === m.id && (
                        <div className="flex items-center gap-2 mt-3">
                          <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="h-[34px] rounded-[7px] px-2.5 text-[12.5px] outline-none" style={{ background: "#101010", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" }} />
                          <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} className="h-[34px] rounded-[7px] px-2.5 text-[12.5px] outline-none" style={{ background: "#101010", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" }} />
                          <button onClick={() => reschedule(m.id)} disabled={busyId === m.id} className="h-[34px] px-3 rounded-[7px] bg-white text-black text-[12px] font-semibold">
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
