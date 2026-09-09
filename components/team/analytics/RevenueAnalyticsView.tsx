"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ANALYTICS_RANGES } from "@/lib/team/analytics/date-range";
import type { AnalyticsRange, RevenueAnalytics } from "@/lib/team/analytics/types";
import { formatMoney, formatPercent } from "@/lib/team/analytics/format";

function moneyLabel(n: number) {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default function RevenueAnalyticsView({ initial, isOwner }: { initial: RevenueAnalytics; isOwner: boolean }) {
  const [range, setRange] = useState<AnalyticsRange>("30d");
  const [planFilter, setPlanFilter] = useState<string>("");
  const [repFilter, setRepFilter] = useState<string>("");
  const [compare, setCompare] = useState(true);
  const [data, setData] = useState<RevenueAnalytics>(initial);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams({ range });
    if (planFilter) params.set("plan", planFilter);
    if (repFilter) params.set("repId", repFilter);
    setLoading(true);
    fetch(`/api/team/analytics/revenue?${params.toString()}`)
      .then((r) => r.json())
      .then((d: RevenueAnalytics) => setData(d))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, planFilter, repFilter]);

  const { summary } = data;

  return (
    <div className="flex flex-col gap-6">
      {/* range + filters */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="inline-flex items-center gap-0.5 p-[3px] rounded-[10px] flex-wrap" style={{ background: "#121212", border: "1px solid rgba(255,255,255,0.06)" }}>
          {ANALYTICS_RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className="h-7 px-3 rounded-[7px] text-[11.5px] font-medium transition-colors"
              style={range === r.key ? { background: "#F5F5F7", color: "#090909" } : { color: "#A1A1A6" }}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-1.5 text-[12px] text-[#A1A1A6] cursor-pointer select-none">
            <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} className="accent-white" />
            Compare previous period
          </label>

          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            className="h-8 rounded-[7px] px-2.5 text-[12px] outline-none"
            style={{ background: "#121212", border: "1px solid rgba(255,255,255,0.08)", color: "#D0D0D0" }}
          >
            <option value="">All Plans</option>
            <option value="revenue_presence">Revenue Presence</option>
            <option value="revenue_growth">Revenue Growth</option>
            <option value="revenue_dominance">Revenue Dominance</option>
          </select>

          {isOwner && data.employees && data.employees.length > 0 && (
            <select
              value={repFilter}
              onChange={(e) => setRepFilter(e.target.value)}
              className="h-8 rounded-[7px] px-2.5 text-[12px] outline-none"
              style={{ background: "#121212", border: "1px solid rgba(255,255,255,0.08)", color: "#D0D0D0" }}
            >
              <option value="">All Employees</option>
              {data.employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-[14px]">
        <KpiCard
          title="Total Revenue"
          value={formatMoney(summary.revenue)}
          context={
            compare && summary.previousRevenue !== null
              ? summary.changePercent !== null
                ? `${formatPercent(summary.changePercent)} vs previous period`
                : "New revenue in this period"
              : "closed deals, not cash collected"
          }
        />
        <KpiCard title="Deals Won" value={String(summary.dealsWon)} context="in range" />
        <KpiCard title="Avg Deal Value" value={summary.dealsWon > 0 ? formatMoney(summary.averageDealValue) : "—"} context="per won deal" />
        <KpiCard title="MRR" value="Not available yet" context="no recurring billing model yet" muted />
      </div>

      {/* revenue over time */}
      <div className="rounded-[8px] p-7" style={{ background: "#121212", border: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="text-[15px] text-[#D6D6D6] mb-1">Revenue Over Time</div>
        <div className="text-[12.5px] text-[#6E6E73] mb-4">Closed revenue — deals marked Won, bucketed by {data.granularity}</div>
        {summary.revenue === 0 ? (
          <div className="h-[280px] flex items-center justify-center text-[13px] text-[#6E6E73]">No revenue recorded in this period.</div>
        ) : (
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.timeline} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueTimelineFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#30D158" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#30D158" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="1 8" stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#666666", fontSize: 12 }} axisLine={false} tickLine={false} minTickGap={24} interval="preserveStartEnd" />
                <YAxis tick={{ fill: "#666666", fontSize: 12 }} axisLine={false} tickLine={false} width={48} tickFormatter={(v) => `$${Intl.NumberFormat("en", { notation: "compact" }).format(v)}`} />
                <Tooltip
                  contentStyle={{ background: "#101010", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "10px 12px" }}
                  labelStyle={{ color: "#F5F5F7", fontSize: 12 }}
                  itemStyle={{ color: "#D0D0D0", fontSize: 12 }}
                  formatter={(v) => [formatMoney(Number(v)), "Revenue"]}
                />
                <Area type="linear" dataKey="revenue" name="Revenue" stroke="#30D158" strokeWidth={2} fill="url(#revenueTimelineFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* by plan + by rep */}
      <div className="grid md:grid-cols-2 gap-[14px]">
        <div className="rounded-[8px] p-6" style={{ background: "#121212", border: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="text-[13.5px] text-[#D6D6D6] mb-4">Revenue by Plan</div>
          {data.byPlan.length === 0 ? (
            <p className="text-[12.5px] text-[#6E6E73]">No revenue recorded in this range yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {data.byPlan.map((p) => (
                <div key={p.planKey}>
                  <div className="flex items-center justify-between text-[12.5px] mb-1">
                    <span className="text-[#F5F5F7]">{p.planLabel}</span>
                    <span className="text-[#A1A1A6]">
                      {formatMoney(p.revenue)} · {p.deals} deal{p.deals === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="h-[6px] rounded-full bg-white/[0.06] overflow-hidden">
                    <div className="h-full rounded-full bg-[#30D158]" style={{ width: `${p.sharePercent}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-[8px] p-6" style={{ background: "#121212", border: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="text-[13.5px] text-[#D6D6D6] mb-4">Revenue by Rep</div>
          {!isOwner ? (
            <p className="text-[12.5px] text-[#6E6E73]">Only visible to the account owner.</p>
          ) : !data.byRep || data.byRep.length === 0 ? (
            <p className="text-[12.5px] text-[#6E6E73]">No revenue recorded in this range yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {data.byRep.map((r) => {
                const max = data.byRep![0].revenue || 1;
                return (
                  <div key={r.repId}>
                    <div className="flex items-center justify-between text-[12.5px] mb-1">
                      <span className="text-[#F5F5F7]">{r.repName}</span>
                      <span className="text-[#A1A1A6]">
                        {formatMoney(r.revenue)} · {r.deals} deal{r.deals === 1 ? "" : "s"} · avg {formatMoney(r.averageDealValue)}
                      </span>
                    </div>
                    <div className="h-[6px] rounded-full bg-white/[0.06] overflow-hidden">
                      <div className="h-full rounded-full bg-[#0A84FF]" style={{ width: `${(r.revenue / max) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* recent revenue */}
      <div className="rounded-[8px] overflow-hidden" style={{ background: "#121212", border: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="px-6 py-4 text-[13.5px] text-[#D6D6D6]" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          Recent Revenue
        </div>
        {data.recent.length === 0 ? (
          <div className="px-6 py-8 text-center text-[12.5px] text-[#6E6E73]">No revenue events in this range yet.</div>
        ) : (
          <table className="w-full text-[12.5px]">
            <thead>
              <tr style={{ background: "#0E0E0E" }}>
                {["Date", "Business", "Rep", "Plan", "Amount"].map((h) => (
                  <th key={h} className="text-left px-6 py-2.5 text-[10.5px] font-semibold uppercase tracking-wide text-[#6E6E73]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.recent.map((r) => (
                <tr key={r.id} style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                  <td className="px-6 py-3 text-[#A1A1A6]">{new Date(r.occurredAt).toLocaleDateString()}</td>
                  <td className="px-6 py-3 text-[#F5F5F7]">
                    {r.leadId ? (
                      <Link href={`/team/leads/${r.leadId}`} className="hover:underline">
                        {r.businessName || "Unnamed lead"}
                      </Link>
                    ) : (
                      r.businessName || "—"
                    )}
                  </td>
                  <td className="px-6 py-3 text-[#A1A1A6]">{r.repName || "—"}</td>
                  <td className="px-6 py-3 text-[#A1A1A6]">{r.planLabel}</td>
                  <td className="px-6 py-3 text-[#F5F5F7]">{formatMoney(r.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {loading && <div className="text-[11px] text-[#6E6E73]">Updating…</div>}
    </div>
  );
}

function KpiCard({ title, value, context, muted }: { title: string; value: string; context?: string; muted?: boolean }) {
  return (
    <div className="rounded-[8px] p-5" style={{ background: "#121212", border: "1px solid rgba(255,255,255,0.05)" }}>
      <div className="text-[12px] text-[#6E6E73] mb-2">{title}</div>
      <div className={`text-[22px] font-semibold ${muted ? "text-[#6E6E73]" : "text-[#F5F5F7]"}`}>{value}</div>
      {context && <div className="text-[11px] text-[#6E6E73] mt-1.5">{context}</div>}
    </div>
  );
}
