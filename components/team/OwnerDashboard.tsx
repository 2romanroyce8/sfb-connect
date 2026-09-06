import Link from "next/link";
import { Phone, CalendarCheck, TrendingUp, Clock, Users } from "lucide-react";
import MetricCard from "./MetricCard";
import PerformanceChart from "./PerformanceChart";
import RecentLeadsTable from "./RecentLeadsTable";

type Rep = { id: string; full_name: string | null; email: string };
type CallStats = {
  callsToday: number;
  talkTimeToday: number;
  avgDurationToday: number;
  outcomesToday: Record<string, number>;
  leadToCallConversion: number;
  conversionRate: number;
};
type RepActivity = { id: string; name: string; callsToday: number; talkTimeToday: number };
type RecentLead = { id: string; business_name: string | null; pipeline_stage: string; updated_at: string; assigned_rep_name: string | null };

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

export default function OwnerDashboard({
  name,
  totalLeads,
  qualifiedLeads,
  meetingsBooked,
  won,
  reps,
  callStats,
  repActivity,
  chartData,
  recentLeads,
}: {
  name: string;
  totalLeads: number;
  qualifiedLeads: number;
  meetingsBooked: number;
  won: number;
  reps: Rep[];
  callStats: CallStats;
  repActivity: RepActivity[];
  chartData: { calls: { at: string }[]; meetings: { at: string }[] };
  recentLeads: RecentLead[];
}) {
  return (
    <div className="px-[30px] py-7 max-w-[1240px]" style={{ background: "#0B0B0B" }}>
      <div className="flex items-center gap-2.5 mb-6">
        <div className="text-[22px] font-semibold text-[#F5F5F7]">Dashboard</div>
      </div>
      <div className="mb-6 -mt-4 text-[13px] text-[#6E6E73]">Good day, {name} — company command center</div>

      {/* three primary metric cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-[14px] mb-4">
        <MetricCard icon={Phone} title="Calls Today" value={callStats.callsToday} context="across the team" />
        <MetricCard icon={CalendarCheck} title="Meetings Booked" value={meetingsBooked} context="all time, status: booked" />
        <MetricCard icon={TrendingUp} title="Conversion Rate" value={`${callStats.conversionRate}%`} context="meetings per call, all time" />
      </div>

      {/* performance chart */}
      <div className="mb-[18px]">
        <PerformanceChart calls={chartData.calls} meetings={chartData.meetings} />
      </div>

      {/* secondary stat row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-[14px] mb-[18px]">
        <MetricCard icon={Users} title="Total Leads" value={totalLeads} />
        <MetricCard icon={Users} title="Qualified Leads" value={qualifiedLeads} />
        <MetricCard icon={Clock} title="Talk Time Today" value={formatDuration(callStats.talkTimeToday)} />
        <MetricCard icon={TrendingUp} title="Deals Won" value={won} />
      </div>

      {Object.keys(callStats.outcomesToday).length > 0 && (
        <div className="flex flex-wrap gap-2 mb-[18px]">
          {Object.entries(callStats.outcomesToday).map(([outcome, count]) => (
            <div
              key={outcome}
              className="px-3 py-1.5 rounded-[6px] text-[12px] text-[#A1A1A6] capitalize"
              style={{ background: "#121212", border: "1px solid rgba(255,255,255,0.05)" }}
            >
              {outcome.replace(/_/g, " ")}: {count}
            </div>
          ))}
        </div>
      )}

      {/* recent lead activity */}
      <div className="mb-[18px]">
        <RecentLeadsTable leads={recentLeads} showRep />
      </div>

      {/* team */}
      <div className="mb-2 text-[15px] font-medium text-[#F5F5F7]">Team</div>
      {reps.length === 0 ? (
        <div className="rounded-[8px] p-8 text-center" style={{ background: "#121212", border: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="text-[15px] font-medium text-[#F5F5F7] mb-1.5">No sales reps yet</div>
          <p className="text-[13px] text-[#A1A1A6] mb-5">Invite your first sales rep to start tracking team performance.</p>
          <Link href="/team/team" className="inline-flex h-[38px] px-4 items-center rounded-[6px] bg-white text-black text-[12.5px] font-semibold">
            Invite Team Member
          </Link>
        </div>
      ) : (
        <div className="rounded-[8px] overflow-hidden mb-8" style={{ background: "#121212", border: "1px solid rgba(255,255,255,0.05)" }}>
          {reps.map((rep, i) => {
            const activity = repActivity.find((r) => r.id === rep.id);
            return (
              <div
                key={rep.id}
                className="flex items-center justify-between px-6"
                style={{ height: 52, borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : undefined }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-white text-black flex items-center justify-center text-[11px] font-bold">
                    {(rep.full_name || rep.email).slice(0, 1).toUpperCase()}
                  </div>
                  <span className="text-[13px] text-[#D8D8D8]">{rep.full_name || rep.email}</span>
                </div>
                <span className="text-[12.5px] text-[#A1A1A6]">
                  {activity ? `${activity.callsToday} calls today · ${formatDuration(activity.talkTimeToday)} talk time` : "No activity today"}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex gap-3">
        <Link href="/team/leads/import" className="h-[38px] px-4 inline-flex items-center rounded-[6px] bg-white text-black text-[13px] font-semibold">
          Research a Business
        </Link>
        <Link href="/team/leads" className="h-[38px] px-4 inline-flex items-center rounded-[6px] text-[13px] text-[#A1A1A6]" style={{ border: "1px solid rgba(255,255,255,0.12)" }}>
          View All Leads
        </Link>
      </div>
    </div>
  );
}
