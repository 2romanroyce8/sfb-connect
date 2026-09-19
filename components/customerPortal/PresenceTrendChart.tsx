"use client";

import { useMemo, useState } from "react";
import type { PresencePoint } from "@/lib/customerPortal/progress";

const RANGES: { key: string; label: string; days: number | null }[] = [
  { key: "30d", label: "30D", days: 30 },
  { key: "90d", label: "90D", days: 90 },
  { key: "6m", label: "6M", days: 182 },
  { key: "1y", label: "1Y", days: 365 },
  { key: "all", label: "ALL", days: null },
];

/**
 * Plots ONLY real recorded presence_scores points -- no interpolation, no
 * manufactured daily values. If there are 3 real observations, this draws
 * exactly 3 points.
 */
export default function PresenceTrendChart({ points }: { points: PresencePoint[] }) {
  const [range, setRange] = useState("all");

  const filtered = useMemo(() => {
    const rangeDef = RANGES.find((r) => r.key === range);
    if (!rangeDef?.days) return points;
    const cutoff = Date.now() - rangeDef.days * 24 * 60 * 60 * 1000;
    return points.filter((p) => new Date(p.recorded_at).getTime() >= cutoff);
  }, [points, range]);

  const width = 560;
  const height = 140;
  const padding = 24;

  const svgPoints = useMemo(() => {
    if (filtered.length === 0) return [];
    const times = filtered.map((p) => new Date(p.recorded_at).getTime());
    const minT = Math.min(...times);
    const maxT = Math.max(...times);
    const spanT = maxT - minT || 1;
    return filtered.map((p) => {
      const t = new Date(p.recorded_at).getTime();
      const x = padding + ((t - minT) / spanT) * (width - padding * 2);
      const y = height - padding - (p.overall_score / 100) * (height - padding * 2);
      return { x, y, score: p.overall_score, date: p.recorded_at };
    });
  }, [filtered]);

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[13px] font-semibold text-neutral-900">Presence Trend</h2>
        <div className="flex items-center gap-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`h-7 px-2.5 rounded-full text-[11px] font-medium ${
                range === r.key ? "bg-neutral-900 text-white" : "text-neutral-500 hover:bg-neutral-100"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="border border-neutral-200 rounded-xl p-5">
        {filtered.length === 0 ? (
          <div className="text-[13px] text-neutral-500 py-8 text-center">No measurements in this period.</div>
        ) : filtered.length === 1 ? (
          <div className="text-[13px] text-neutral-500 py-8 text-center">
            One measurement recorded ({filtered[0].overall_score} on {new Date(filtered[0].recorded_at).toLocaleDateString()}). More measurements are
            needed to plot a trend.
          </div>
        ) : (
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[140px]" preserveAspectRatio="none">
            <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#e5e5e5" strokeWidth={1} />
            <polyline fill="none" stroke="#171717" strokeWidth={2} points={svgPoints.map((p) => `${p.x},${p.y}`).join(" ")} />
            {svgPoints.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={3} fill="#171717" />
            ))}
          </svg>
        )}
        {filtered.length > 0 && (
          <div className="flex justify-between text-[11px] text-neutral-400 mt-2">
            <span>{new Date(filtered[0].recorded_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
            <span>{new Date(filtered[filtered.length - 1].recorded_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
          </div>
        )}
      </div>
    </section>
  );
}
