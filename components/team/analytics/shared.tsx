"use client";

import { ANALYTICS_RANGES } from "@/lib/team/analytics/date-range";
import type { AnalyticsRange } from "@/lib/team/analytics/types";

export const card: React.CSSProperties = { background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" };
export const money = (n: number, frac = 0) => `$${n.toLocaleString("en-US", { minimumFractionDigits: frac, maximumFractionDigits: 2 })}`;

export function RangeBar({ range, onChange, right }: { range: AnalyticsRange; onChange: (r: AnalyticsRange) => void; right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 justify-between">
      <div className="inline-flex items-center gap-0.5 p-[3px] rounded-[10px] flex-wrap" style={{ background: "#121212", border: "1px solid rgba(255,255,255,0.06)" }}>
        {ANALYTICS_RANGES.map((r) => <button key={r.key} onClick={() => onChange(r.key)} className="h-7 px-3 rounded-[7px] text-[11.5px] font-medium transition-colors" style={range === r.key ? { background: "#F5F5F7", color: "#090909" } : { color: "#A1A1A6" }}>{r.label}</button>)}
      </div>
      {right}
    </div>
  );
}

export function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string | null; tone?: "good" | "bad" | "warn" }) {
  const color = tone === "good" ? "#30D158" : tone === "bad" ? "#FF453A" : tone === "warn" ? "#FFD60A" : "#F5F5F7";
  return (
    <div className="rounded-[12px] p-4" style={card}>
      <div className="text-[11px] uppercase tracking-[0.12em] text-[#6E6E73]">{label}</div>
      <div className="text-[22px] font-semibold mt-1 tabular-nums" style={{ color }}>{value}</div>
      {sub ? <div className="text-[11.5px] text-[#6E6E73] mt-0.5">{sub}</div> : null}
    </div>
  );
}

export function CacheStamp({ cache, onRefresh, busy }: { cache: { fetchedAt: string; fromCache: boolean; ageMs: number; ttlMs: number; error: string | null } | null; onRefresh: () => void; busy: boolean }) {
  if (!cache) return null;
  const mins = Math.round(cache.ageMs / 60000);
  return (
    <div className="flex items-center gap-3 text-[11.5px] text-[#6E6E73]">
      <span>Pulled {new Date(cache.fetchedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}{cache.fromCache ? ` · cached ${mins < 1 ? "<1" : mins} min` : " · live"} · auto-refresh every {Math.round(cache.ttlMs / 60000)} min</span>
      {cache.error && <span className="text-[#FF9F9A]">last pull failed: {cache.error} — showing the previous numbers</span>}
      <button onClick={onRefresh} disabled={busy} className="h-7 px-3 rounded-[7px] text-[11.5px] font-medium disabled:opacity-50" style={{ border: "1px solid rgba(255,255,255,0.14)", color: "#F5F5F7" }}>{busy ? "Refreshing…" : "Refresh"}</button>
    </div>
  );
}
