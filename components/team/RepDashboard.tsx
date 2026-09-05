import Link from "next/link";
import { Phone, Bell, CalendarCheck } from "lucide-react";

type Lead = {
  id: string;
  business_name: string | null;
  website: string | null;
  pipeline_stage: string;
  ai_overall_score: number | null;
  recommended_offer: string | null;
};
type Followup = { id: string; lead_id: string; due_at: string; reason: string | null };
type Meeting = { id: string; lead_id: string; scheduled_at: string; contact_name: string | null };
type CallStats = { callsToday: number; talkTimeToday: number; avgDurationToday: number };

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

export default function RepDashboard({
  name,
  leads,
  followups,
  meetings,
  callStats,
}: {
  name: string;
  leads: Lead[];
  followups: Followup[];
  meetings: Meeting[];
  callStats: CallStats;
}) {
  const nextLead = leads.find((l) => l.pipeline_stage === "ready_to_call") || leads[0];

  return (
    <div className="px-8 py-8 max-w-[1100px]">
      <div className="mb-8">
        <div className="text-[22px] font-semibold text-[#F5F5F7]">Good day, {name}</div>
        <div className="text-[13px] text-[#6E6E73] mt-1">
          {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-8">
        <div className="p-4 rounded-[12px]" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="text-[24px] font-semibold text-[#F5F5F7]">{leads.length}</div>
          <div className="text-[11px] text-[#6E6E73] mt-1">My Leads</div>
        </div>
        <div className="p-4 rounded-[12px]" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="text-[24px] font-semibold text-[#F5F5F7]">{followups.length}</div>
          <div className="text-[11px] text-[#6E6E73] mt-1">Follow-Ups Due</div>
        </div>
        <div className="p-4 rounded-[12px]" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="text-[24px] font-semibold text-[#F5F5F7]">{meetings.length}</div>
          <div className="text-[11px] text-[#6E6E73] mt-1">Meetings Booked</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-8">
        <div className="p-4 rounded-[12px]" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="text-[24px] font-semibold text-[#F5F5F7]">{callStats.callsToday}</div>
          <div className="text-[11px] text-[#6E6E73] mt-1">Calls Today</div>
        </div>
        <div className="p-4 rounded-[12px]" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="text-[24px] font-semibold text-[#F5F5F7]">{formatDuration(callStats.talkTimeToday)}</div>
          <div className="text-[11px] text-[#6E6E73] mt-1">Talk Time Today</div>
        </div>
        <div className="p-4 rounded-[12px]" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="text-[24px] font-semibold text-[#F5F5F7]">{formatDuration(callStats.avgDurationToday)}</div>
          <div className="text-[11px] text-[#6E6E73] mt-1">Avg Call Duration</div>
        </div>
      </div>

      <div className="mb-2 text-[11px] font-semibold tracking-[0.08em] uppercase text-[#6E6E73]">
        Next Action
      </div>
      {nextLead ? (
        <div
          className="p-5 rounded-[14px] mb-10 flex items-center justify-between"
          style={{ background: "#101010", border: "1px solid rgba(255,255,255,0.10)" }}
        >
          <div>
            <div className="text-[16px] font-semibold text-[#F5F5F7]">
              {nextLead.business_name || "Unnamed lead"}
            </div>
            <div className="text-[12px] text-[#6E6E73] mt-1">
              {nextLead.recommended_offer
                ? nextLead.recommended_offer.replace(/_/g, " ")
                : "Not yet analyzed"}
              {nextLead.ai_overall_score != null && ` · AI Presence ${nextLead.ai_overall_score}/100`}
            </div>
          </div>
          <Link
            href={`/team/leads/${nextLead.id}/call`}
            className="h-[38px] px-4 inline-flex items-center gap-1.5 rounded-[8px] bg-white text-black text-[13px] font-semibold shrink-0"
          >
            <Phone size={14} /> Call
          </Link>
        </div>
      ) : (
        <div
          className="p-6 rounded-[14px] mb-10 text-center"
          style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <p className="text-[13px] text-[#A1A1A6] mb-3">
            No leads assigned to you yet.
          </p>
          <Link
            href="/team/leads/import"
            className="inline-flex h-[36px] px-4 items-center rounded-[8px] bg-white text-black text-[12.5px] font-semibold"
          >
            Research a Business
          </Link>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <div className="mb-2 text-[11px] font-semibold tracking-[0.08em] uppercase text-[#6E6E73] flex items-center gap-1.5">
            <Bell size={12} /> Follow-Ups
          </div>
          {followups.length === 0 ? (
            <p className="text-[12.5px] text-[#6E6E73]">Nothing due.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {followups.map((f) => (
                <div
                  key={f.id}
                  className="p-3 rounded-[10px] text-[12.5px] text-[#A1A1A6]"
                  style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  {f.reason || "Follow up"} —{" "}
                  {new Date(f.due_at).toLocaleDateString()}
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="mb-2 text-[11px] font-semibold tracking-[0.08em] uppercase text-[#6E6E73] flex items-center gap-1.5">
            <CalendarCheck size={12} /> Meetings
          </div>
          {meetings.length === 0 ? (
            <p className="text-[12.5px] text-[#6E6E73]">Nothing booked.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {meetings.map((m) => (
                <div
                  key={m.id}
                  className="p-3 rounded-[10px] text-[12.5px] text-[#A1A1A6]"
                  style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  {m.contact_name || "Meeting"} —{" "}
                  {new Date(m.scheduled_at).toLocaleString()}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
