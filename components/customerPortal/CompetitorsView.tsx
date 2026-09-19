"use client";

import { useState } from "react";
import type { CompetitorSummary } from "@/lib/customerPortal/competitors";

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export default function CompetitorsView({ competitors }: { competitors: CompetitorSummary[] }) {
  const [selected, setSelected] = useState<CompetitorSummary | null>(null);
  const [rows, setRows] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function openCompare(c: CompetitorSummary) {
    setSelected(c);
    setRows(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/competitors/head-to-head?competitorId=${c.id}`);
      const data = await res.json();
      setRows(data.rows ?? []);
    } finally {
      setLoading(false);
    }
  }

  if (competitors.length === 0) {
    return (
      <div className="border border-neutral-200 rounded-xl p-6 text-[13px] text-neutral-500">
        No competitors on file yet. Competitors you tell SFB about during setup will appear here.
      </div>
    );
  }

  return (
    <div>
      <div className="border border-neutral-200 rounded-xl divide-y divide-neutral-100 mb-8">
        {competitors.map((c) => (
          <div key={c.id} className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-neutral-100 flex items-center justify-center text-[12px] font-semibold text-neutral-600 shrink-0">
                {initials(c.name)}
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-neutral-900 truncate">{c.name}</div>
                <div className="text-[11.5px] text-neutral-400">
                  {c.website || "No website on file"} · Tracked since {new Date(c.trackedSince).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                </div>
              </div>
            </div>
            <div className="shrink-0 flex items-center gap-4">
              {c.observedQueries > 0 ? (
                <div className="text-right">
                  <div className="text-[13px] font-medium text-neutral-900">
                    {c.detectedQueries}/{c.observedQueries}
                  </div>
                  <div className="text-[10.5px] text-neutral-400">detected</div>
                </div>
              ) : (
                <span className="text-[11.5px] text-neutral-400">Not yet monitored</span>
              )}
              {c.observedQueries > 0 && (
                <button onClick={() => openCompare(c)} className="h-8 px-3 rounded-full border border-neutral-200 text-[12px] font-medium">
                  Compare
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30" onClick={() => setSelected(null)}>
          <div className="bg-white w-full sm:max-w-[520px] sm:rounded-2xl rounded-t-2xl max-h-[85vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="text-[15px] font-semibold text-neutral-900 mb-4">You vs {selected.name}</div>
            {loading && <div className="text-[13px] text-neutral-400">Loading...</div>}
            {!loading && rows && rows.length === 0 && (
              <div className="text-[13px] text-neutral-500">No shared tracked queries yet -- comparison requires the same query checked for both.</div>
            )}
            {!loading && rows && rows.length > 0 && (
              <div className="flex flex-col gap-2">
                {rows.map((r, i) => (
                  <div key={i} className="border border-neutral-100 rounded-lg p-3">
                    <div className="text-[12.5px] text-neutral-800 mb-2">
                      &ldquo;{r.queryText}&rdquo; <span className="text-neutral-400">· {r.platform}</span>
                    </div>
                    <div className="flex items-center gap-4 text-[12px]">
                      <div>
                        You: <span className="font-medium">{r.yourStatus.replace(/_/g, " ")}</span>
                        {r.yourPosition ? ` (#${r.yourPosition})` : ""}
                      </div>
                      <div>
                        {selected.name}: <span className="font-medium">{r.competitorStatus.replace(/_/g, " ")}</span>
                        {r.competitorPosition ? ` (#${r.competitorPosition})` : ""}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setSelected(null)} className="mt-6 w-full h-10 rounded-full border border-neutral-200 text-[13px] font-medium">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
