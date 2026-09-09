"use client";

import { useMemo, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

type RawPoint = { at: string };

const RANGES: { key: string; label: string; days: number }[] = [
  { key: "7d", label: "Last 7 days", days: 7 },
  { key: "30d", label: "Last 30 days", days: 30 },
  { key: "90d", label: "Last 3 months", days: 90 },
];

function bucketByDay(points: RawPoint[], days: number) {
  // Today first (left), then going backward through the rest of the
  // range -- insertion order here is what the chart renders left-to-right,
  // since Map preserves insertion order.
  const buckets = new Map<string, number>();
  const now = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const p of points) {
    const key = p.at.slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) || 0) + 1);
  }
  return Array.from(buckets.entries()).map(([date, count]) => ({
    date,
    label: new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    count,
  }));
}

export default function PerformanceChart({ calls, meetings }: { calls: RawPoint[]; meetings: RawPoint[] }) {
  const [range, setRange] = useState("30d");
  const days = RANGES.find((r) => r.key === range)?.days || 30;

  const data = useMemo(() => {
    const callBuckets = bucketByDay(calls, days);
    const meetingBuckets = bucketByDay(meetings, days);
    return callBuckets.map((c, i) => ({ label: c.label, calls: c.count, meetings: meetingBuckets[i]?.count || 0 }));
  }, [calls, meetings, days]);

  const totalCalls = data.reduce((s, d) => s + d.calls, 0);
  const totalMeetings = data.reduce((s, d) => s + d.meetings, 0);

  const hasData = totalCalls > 0 || totalMeetings > 0;

  return (
    <div className="rounded-[8px] p-7" style={{ background: "#121212", border: "1px solid rgba(255,255,255,0.05)" }}>
      <div className="flex items-start justify-between mb-1">
        <div>
          <div className="text-[15px] text-[#D6D6D6]">Sales Performance</div>
          <div className="text-[34px] font-semibold text-[#F5F5F7] mt-2 leading-none">{totalMeetings}</div>
          <div className="text-[12.5px] text-[#6E6E73] mt-1.5">Meetings booked · {totalCalls} calls in range</div>
        </div>
        <select
          value={range}
          onChange={(e) => setRange(e.target.value)}
          className="h-[38px] rounded-[6px] px-3.5 text-[12.5px] outline-none"
          style={{ background: "#191919", border: "1px solid rgba(255,255,255,0.04)", color: "#D0D0D0" }}
        >
          {RANGES.map((r) => (
            <option key={r.key} value={r.key}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      {!hasData ? (
        <div className="h-[280px] flex items-center justify-center text-[13px] text-[#6E6E73]">
          No calls or meetings recorded in this range yet.
        </div>
      ) : (
        <div style={{ height: 300, marginTop: 18 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="callsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#20C7B7" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="#20C7B7" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="1 8" stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "#666666", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                minTickGap={24}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fill: "#666666", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
              <Tooltip
                contentStyle={{ background: "#101010", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "10px 12px" }}
                labelStyle={{ color: "#F5F5F7", fontSize: 12 }}
                itemStyle={{ color: "#D0D0D0", fontSize: 12 }}
              />
              <Area type="linear" dataKey="calls" name="Calls" stroke="#20C7B7" strokeWidth={2} fill="url(#callsFill)" />
              <Area type="linear" dataKey="meetings" name="Meetings Booked" stroke="#0A84FF" strokeWidth={1.5} fill="transparent" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
