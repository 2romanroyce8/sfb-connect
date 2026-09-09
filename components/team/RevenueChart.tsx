"use client";

import { useMemo, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

type RevenueEvent = { occurred_at: string; amount: number };

const RANGES: { key: string; label: string; days: number }[] = [
  { key: "7d", label: "Last 7 days", days: 7 },
  { key: "30d", label: "Last 30 days", days: 30 },
  { key: "90d", label: "Last 3 months", days: 90 },
];

function formatMoney(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function bucketRevenueByDay(events: RevenueEvent[], days: number) {
  // Today first (left), then going backward -- same fix applied here from
  // the start as the one made to the old Sales Performance chart.
  const buckets = new Map<string, number>();
  const now = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const e of events) {
    const key = e.occurred_at.slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) || 0) + e.amount);
  }
  return Array.from(buckets.entries()).map(([date, amount]) => ({
    date,
    // Parse as local midnight, not UTC midnight -- see PerformanceChart.tsx
    // for why the naive `new Date(dateOnlyString)` shifts labels a day back
    // in any UTC-negative timezone.
    label: new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    amount: Math.round(amount * 100) / 100,
  }));
}

export default function RevenueChart({ events }: { events: RevenueEvent[] }) {
  const [range, setRange] = useState("30d");
  const days = RANGES.find((r) => r.key === range)?.days || 30;

  const data = useMemo(() => bucketRevenueByDay(events, days), [events, days]);
  const totalRevenue = data.reduce((s, d) => s + d.amount, 0);
  const hasData = totalRevenue > 0;

  return (
    <div className="rounded-[8px] p-7" style={{ background: "#121212", border: "1px solid rgba(255,255,255,0.05)" }}>
      <div className="flex items-start justify-between mb-1">
        <div>
          <div className="text-[15px] text-[#D6D6D6]">Revenue</div>
          <div className="text-[34px] font-semibold text-[#F5F5F7] mt-2 leading-none">{formatMoney(totalRevenue)}</div>
          <div className="text-[12.5px] text-[#6E6E73] mt-1.5">Closed revenue in range — deals marked Won, not verified cash collected</div>
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
          No revenue recorded in this range yet.
        </div>
      ) : (
        <div style={{ height: 300, marginTop: 18 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#30D158" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#30D158" stopOpacity={0} />
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
              <YAxis
                tick={{ fill: "#666666", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={48}
                tickFormatter={(v) => `$${Intl.NumberFormat("en", { notation: "compact" }).format(v)}`}
              />
              <Tooltip
                contentStyle={{ background: "#101010", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "10px 12px" }}
                labelStyle={{ color: "#F5F5F7", fontSize: 12 }}
                itemStyle={{ color: "#D0D0D0", fontSize: 12 }}
                formatter={(v) => [formatMoney(Number(v)), "Revenue"]}
              />
              <Area type="linear" dataKey="amount" name="Revenue" stroke="#30D158" strokeWidth={2} fill="url(#revenueFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
