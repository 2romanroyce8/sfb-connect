"use client";

import { useEffect, useState } from "react";
import { Trophy, Medal, Phone, CalendarCheck, DollarSign } from "lucide-react";

type Row = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  points: number;
  dealsWon: number;
  meetingsAttended: number;
  revenue: number;
  rank: number;
};

type RecentEvent = { id: string; event_type: string; points: number; description: string | null; occurred_at: string; reversed: boolean };

const PERIODS = [
  { key: "today", label: "TODAY" },
  { key: "week", label: "THIS WEEK" },
  { key: "month", label: "THIS MONTH" },
  { key: "all", label: "ALL TIME" },
] as const;

type PeriodKey = (typeof PERIODS)[number]["key"];

const EVENT_LABELS: Record<string, string> = {
  call_completed: "Call completed",
  qualified_conversation: "Qualified conversation",
  followup_created: "Follow-up created",
  demo_booked: "Demo booked",
  demo_attended: "Demo attended",
  sale_revenue_presence: "Revenue Presence sale",
  sale_revenue_growth: "Revenue Growth sale",
  sale_revenue_dominance: "Revenue Dominance sale",
  payment_verified: "Payment verified",
};

function initials(name: string) {
  return name.slice(0, 1).toUpperCase();
}

function Avatar({ url, name, size }: { url: string | null; name: string; size: number }) {
  return (
    <div
      className="rounded-full overflow-hidden flex items-center justify-center shrink-0 font-semibold"
      style={{ width: size, height: size, background: "#1c1c1e", border: "1px solid rgba(255,255,255,0.1)", fontSize: size * 0.36, color: "#F5F5F7" }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={name} className="w-full h-full object-cover" />
      ) : (
        initials(name)
      )}
    </div>
  );
}

export default function CompetitionLeaderboard({
  initialRows,
  initialPeriod,
  currentUserId,
  isOwner,
  recentEvents,
}: {
  initialRows: Row[];
  initialPeriod: PeriodKey;
  currentUserId: string;
  isOwner: boolean;
  recentEvents: RecentEvent[];
}) {
  const [period, setPeriod] = useState<PeriodKey>(initialPeriod);
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (period === initialPeriod) {
      setRows(initialRows);
      return;
    }
    setLoading(true);
    fetch(`/api/team/leaderboard?period=${period}`)
      .then((r) => r.json())
      .then((d) => setRows(d.rows ?? []))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);
  const me = rows.find((r) => r.userId === currentUserId);

  return (
    <div className="flex flex-col gap-6 max-w-[1000px]">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6E6E73] mb-1">Team</div>
        <div className="text-[26px] font-semibold text-[#F5F5F7]">SFB Sales Leaderboard</div>
        <p className="text-[13px] text-[#6E6E73] mt-1">
          Ranked by real, verified Sales OS activity — calls, qualified conversations, booked and attended demos, and closed
          revenue. Points come from a permanent ledger; nothing here can be hand-typed.
        </p>
      </div>

      <div className="inline-flex items-center gap-0.5 p-[3px] rounded-[10px] self-start" style={{ background: "#121212", border: "1px solid rgba(255,255,255,0.06)" }}>
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className="h-8 px-4 rounded-[7px] text-[11.5px] font-semibold tracking-wide transition-colors"
            style={period === p.key ? { background: "#F5F5F7", color: "#090909" } : { color: "#A1A1A6" }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {rows.length === 0 || rows.every((r) => r.points === 0) ? (
        <div className="rounded-[12px] p-10 text-center" style={{ background: "#0E0E0F", border: "1px solid rgba(255,255,255,0.07)" }}>
          <Trophy size={22} className="mx-auto text-[#6E6E73] mb-3" />
          <div className="text-[14px] text-[#F5F5F7] mb-1">No points on the board yet</div>
          <p className="text-[12.5px] text-[#6E6E73] max-w-[420px] mx-auto">
            Rankings appear here the moment real calls, demos, and sales start happening — nothing is shown until it's real.
          </p>
        </div>
      ) : (
        <>
          {/* Podium */}
          <div className="grid grid-cols-3 gap-3 items-end">
            {[podium[1], podium[0], podium[2]].map((r, i) =>
              r ? (
                <PodiumCard key={r.userId} row={r} place={i === 0 ? 2 : i === 1 ? 1 : 3} />
              ) : (
                <div key={i} />
              )
            )}
          </div>

          {/* Rest of rankings */}
          {rest.length > 0 && (
            <div className="rounded-[12px] overflow-hidden" style={{ background: "#0E0E0F", border: "1px solid rgba(255,255,255,0.07)" }}>
              {rest.map((r) => (
                <div
                  key={r.userId}
                  className="flex items-center gap-4 px-5 py-3.5"
                  style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
                >
                  <span className="text-[13px] font-semibold text-[#6E6E73] w-6">{r.rank}</span>
                  <Avatar url={r.avatarUrl} name={r.displayName} size={32} />
                  <span className="text-[13.5px] text-[#F5F5F7] flex-1">{r.displayName}</span>
                  <StatChip icon={CalendarCheck} value={r.meetingsAttended} />
                  <StatChip icon={DollarSign} value={r.dealsWon} />
                  <span className="text-[14px] font-semibold text-[#F5F5F7] w-20 text-right">{r.points.toLocaleString()} pts</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {loading && <div className="text-[11px] text-[#6E6E73]">Updating…</div>}

      {me && (
        <div className="rounded-[12px] p-5" style={{ background: "#0E0E0F", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6E6E73] mb-3">Your recent point activity</div>
          {recentEvents.length === 0 ? (
            <p className="text-[12.5px] text-[#6E6E73]">No point events yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {recentEvents.map((e) => (
                <div key={e.id} className="flex items-center justify-between text-[12.5px]">
                  <span className={e.reversed ? "text-[#6E6E73] line-through" : "text-[#D0D0D0]"}>
                    {e.description || EVENT_LABELS[e.event_type] || e.event_type}
                  </span>
                  <span className={e.reversed ? "text-[#6E6E73]" : "text-[#42E36D]"}>
                    {e.reversed ? "reversed" : `+${e.points}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatChip({ icon: Icon, value }: { icon: React.ElementType; value: number }) {
  return (
    <span className="flex items-center gap-1 text-[11.5px] text-[#6E6E73] w-10">
      <Icon size={12} /> {value}
    </span>
  );
}

function PodiumCard({ row, place }: { row: Row; place: 1 | 2 | 3 }) {
  const heights: Record<1 | 2 | 3, number> = { 1: 220, 2: 180, 3: 160 };
  const labels: Record<1 | 2 | 3, string> = { 1: "1ST", 2: "2ND", 3: "3RD" };
  const accents: Record<1 | 2 | 3, string> = { 1: "#FFD60A", 2: "#C7CBD1", 3: "#C98A4B" };
  return (
    <div
      className="rounded-[14px] p-5 flex flex-col items-center text-center"
      style={{
        height: heights[place],
        justifyContent: "flex-end",
        background: place === 1 ? "linear-gradient(180deg, rgba(255,214,10,0.08) 0%, #0E0E0F 60%)" : "#0E0E0F",
        border: `1px solid ${place === 1 ? "rgba(255,214,10,0.28)" : "rgba(255,255,255,0.07)"}`,
      }}
    >
      <span
        className="text-[10px] font-bold tracking-[0.1em] mb-2 px-2 py-[3px] rounded-full"
        style={{ color: accents[place], border: `1px solid ${accents[place]}55` }}
      >
        {labels[place]}
      </span>
      <Avatar url={row.avatarUrl} name={row.displayName} size={place === 1 ? 56 : 44} />
      <div className="text-[13.5px] font-medium text-[#F5F5F7] mt-2">{row.displayName}</div>
      <div className="text-[18px] font-semibold text-[#F5F5F7] mt-0.5">{row.points.toLocaleString()} <span className="text-[11px] text-[#6E6E73] font-normal">PTS</span></div>
    </div>
  );
}
