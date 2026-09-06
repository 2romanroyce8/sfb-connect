import Link from "next/link";
import { Phone, Bell, CalendarCheck, Users } from "lucide-react";
import MetricCard from "./MetricCard";
import PerformanceChart from "./PerformanceChart";
import RecentLeadsTable from "./RecentLeadsTable";

type Lead = {
  id: string;
  business_name: string | null;
  website: string | null;
  pipeline_stage: string;
  ai_overall_score: number | null;
  recommended_offer: string | null;
  updated_at: string;
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
  chartData,
}: {
  name: string;
  leads: Lead[];
  followups: Followup[];
  meetings: Meeting[];
  callStats: CallStats;
  chartData: { calls: { at: string }[]; meetings: { at: string }[] };
}) {
  // Deterministic "next best lead": highest AI Presence score among leads
  // ready to call, falling back to the most recently updated lead. No AI
  // model picks this — it's a plain sort, same as everywhere else in the CRM.
  const readyToCall = leads.filter((l) => l.pipeline_stage === "ready_to_call").sort((a, b) => (b.ai_overall_score ?? -1) - (a.ai_overall_score ?? -1));
  const nextLead = readyToCall[0] || leads[0];

  return (
    <div className="px-[30px] py-7 max-w-[1240px]" style={{ background: "#0B0B0B" }}>
      <div className="text-[22px] font-semibold text-[#F5F5F7] mb-1">Dashboard</div>
      <div className="text-[13px] text-[#6E6E73] mb-6">
        Good day, {name} — {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-[14px] mb-4">
        <MetricCard icon={Users} title="My Leads" value={leads.length} />
        <MetricCard icon={Phone} title="Calls Today" value={callStats.callsToday} context={`avg ${formatDuration(callStats.avgDurationToday)} per call`} />
        <MetricCard icon={CalendarCheck} title="Meetings Booked" value={meetings.length} context="upcoming" />
      </div>

      <div className="mb-[18px]">
        <PerformanceChart calls={chartData.calls} meetings={chartData.meetings} />
      </div>

      <div className="mb-2 text-[11px] font-semibold tracking-[0.08em] uppercase text-[#6E6E73]">Next Action</div>
      {nextLead ? (
        <div className="p-5 rounded-[8px] mb-[18px] flex items-center justify-between" style={{ background: "#121212", border: "1px solid rgba(255,255,255,0.05)" }}>
          <div>
            <div className="text-[16px] font-semibold text-[#F5F5F7]">{nextLead.business_name || "Unnamed lead"}</div>
            <div className="text-[12px] text-[#6E6E73] mt-1">
              {nextLead.recommended_offer ? nextLead.recommended_offer.replace(/_/g, " ") : "Not yet analyzed"}
              {nextLead.ai_overall_score != null && ` · AI Presence ${nextLead.ai_overall_score}/100`}
            </div>
          </div>
          <Link href={`/team/leads/${nextLead.id}/call`} className="h-[38px] px-4 inline-flex items-center gap-1.5 rounded-[6px] bg-white text-black text-[13px] font-semibold shrink-0">
            <Phone size={14} /> Call
          </Link>
        </div>
      ) : (
        <div className="p-6 rounded-[8px] mb-[18px] text-center" style={{ background: "#121212", border: "1px solid rgba(255,255,255,0.05)" }}>
          <p className="text-[13px] text-[#A1A1A6] mb-3">No leads assigned to you yet.</p>
          <Link href="/team/leads/import" className="inline-flex h-[36px] px-4 items-center rounded-[6px] bg-white text-black text-[12.5px] font-semibold">
            Research a Business
          </Link>
        </div>
      )}

      <div className="mb-[18px]">
        <RecentLeadsTable leads={leads} showRep={false} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <div className="mb-2 text-[11px] font-semibold tracking-[0.08em] uppercase text-[#6E6E73] flex items-center gap-1.5">
            <Bell size={12} /> Follow-Ups
          </div>
          {followups.length === 0 ? (
            <p className="text-[12.5px] text-[#6E6E73]">Nothing due.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {followups.map((f) => (
                <div key={f.id} className="p-3 rounded-[8px] text-[12.5px] text-[#A1A1A6]" style={{ background: "#121212", border: "1px solid rgba(255,255,255,0.05)" }}>
                  {f.reason || "Follow up"} — {new Date(f.due_at).toLocaleDateString()}
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
                <div key={m.id} className="p-3 rounded-[8px] text-[12.5px] text-[#A1A1A6]" style={{ background: "#121212", border: "1px solid rgba(255,255,255,0.05)" }}>
                  {m.contact_name || "Meeting"} — {new Date(m.scheduled_at).toLocaleString()}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
