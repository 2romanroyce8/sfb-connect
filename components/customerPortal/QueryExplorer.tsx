"use client";

import { useMemo, useState } from "react";
import type { LatestObservation, ObservationStatus } from "@/lib/customerPortal/presence";

const STATUS_LABEL: Record<ObservationStatus, string> = {
  not_tested: "Not Yet Tested",
  detected: "Detected",
  not_detected: "Not Detected",
  error: "Error",
  inconclusive: "Inconclusive",
};

const STATUS_STYLE: Record<ObservationStatus, string> = {
  not_tested: "bg-neutral-50 text-neutral-400 border-neutral-200",
  detected: "bg-emerald-50 text-emerald-700 border-emerald-200",
  not_detected: "bg-neutral-50 text-neutral-600 border-neutral-200",
  error: "bg-red-50 text-red-700 border-red-200",
  inconclusive: "bg-amber-50 text-amber-700 border-amber-200",
};

type Filter = "all" | "detected" | "not_detected" | "not_tested" | "improved" | "declined";

function movement(o: LatestObservation): "improved" | "declined" | null {
  if (!o.previous_status) return null;
  if (o.previous_status === "not_detected" && o.status === "detected") return "improved";
  if (o.previous_status === "detected" && o.status === "not_detected") return "declined";
  return null;
}

export default function QueryExplorer({
  observations,
  labels,
  businessId,
}: {
  observations: LatestObservation[];
  labels: Record<string, string>;
  businessId: string;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<LatestObservation | null>(null);
  const [history, setHistory] = useState<any[] | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const filtered = useMemo(() => {
    return observations.filter((o) => {
      if (search && !o.query_text.toLowerCase().includes(search.toLowerCase())) return false;
      if (filter === "all") return true;
      if (filter === "improved") return movement(o) === "improved";
      if (filter === "declined") return movement(o) === "declined";
      return o.status === filter;
    });
  }, [observations, filter, search]);

  async function openDetail(o: LatestObservation) {
    setDetail(o);
    setHistory(null);
    setLoadingHistory(true);
    try {
      const params = new URLSearchParams({ platform: o.platform, query: o.query_text });
      if (o.location_id) params.set("locationId", o.location_id);
      const res = await fetch(`/api/dashboard/presence/query-history?${params.toString()}`);
      const data = await res.json();
      setHistory(data.history ?? []);
    } finally {
      setLoadingHistory(false);
    }
  }

  if (observations.length === 0) {
    return (
      <section>
        <h2 className="text-[13px] font-semibold text-neutral-900 mb-3">Queries We&apos;re Tracking</h2>
        <div className="border border-neutral-200 rounded-xl p-6 text-[13px] text-neutral-500">
          No queries are being tracked yet. This fills in once SFB begins AI visibility monitoring for your business.
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-[13px] font-semibold text-neutral-900 mb-3">Queries We&apos;re Tracking</h2>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search query text..."
          className="h-8 px-3 rounded-full border border-neutral-200 text-[12.5px] outline-none focus:border-neutral-400 w-[200px]"
        />
        {(["all", "detected", "not_detected", "not_tested", "improved", "declined"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`h-8 px-3 rounded-full text-[12px] font-medium border ${
              filter === f ? "bg-neutral-900 text-white border-neutral-900" : "border-neutral-200 text-neutral-600"
            }`}
          >
            {f === "all" ? "All" : f === "not_detected" ? "Not Detected" : f === "not_tested" ? "Not Yet Tested" : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="border border-neutral-200 rounded-xl divide-y divide-neutral-100">
        {filtered.length === 0 ? (
          <div className="p-5 text-[13px] text-neutral-500">No queries match this filter.</div>
        ) : (
          filtered.map((o) => {
            const move = movement(o);
            return (
              <button key={o.id} onClick={() => openDetail(o)} className="w-full text-left p-4 flex items-center justify-between gap-4 hover:bg-neutral-50">
                <div className="min-w-0">
                  <div className="text-[13px] text-neutral-900 truncate">&ldquo;{o.query_text}&rdquo;</div>
                  <div className="text-[11.5px] text-neutral-400 mt-0.5">
                    {labels[o.platform]}
                    {o.observed_position ? ` · Position #${o.observed_position}` : ""}
                    {o.checked_at ? ` · Checked ${new Date(o.checked_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {move && (
                    <span className={`text-[11px] font-medium ${move === "improved" ? "text-emerald-600" : "text-red-600"}`}>
                      {move === "improved" ? "↑ Improved" : "↓ Declined"}
                    </span>
                  )}
                  <span className={`text-[10.5px] font-medium rounded-full px-2 py-0.5 border ${STATUS_STYLE[o.status]}`}>{STATUS_LABEL[o.status]}</span>
                </div>
              </button>
            );
          })
        )}
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30" onClick={() => setDetail(null)}>
          <div className="bg-white w-full sm:max-w-[480px] sm:rounded-2xl rounded-t-2xl max-h-[85vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="text-[15px] font-semibold text-neutral-900 mb-1">&ldquo;{detail.query_text}&rdquo;</div>
            <div className="text-[12.5px] text-neutral-500 mb-5">{labels[detail.platform]}</div>

            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="border border-neutral-200 rounded-lg p-3">
                <div className="text-[10.5px] uppercase text-neutral-400 mb-1">Latest Result</div>
                <span className={`text-[11px] font-medium rounded-full px-2 py-0.5 border ${STATUS_STYLE[detail.status]}`}>{STATUS_LABEL[detail.status]}</span>
              </div>
              <div className="border border-neutral-200 rounded-lg p-3">
                <div className="text-[10.5px] uppercase text-neutral-400 mb-1">Observed Position</div>
                <div className="text-[13px] text-neutral-800">{detail.observed_position ? `#${detail.observed_position}` : "Not applicable"}</div>
              </div>
            </div>

            <div className="text-[11.5px] font-semibold text-neutral-500 uppercase tracking-wide mb-2">Check History</div>
            {loadingHistory && <div className="text-[13px] text-neutral-400">Loading...</div>}
            {!loadingHistory && history && history.length === 0 && <div className="text-[13px] text-neutral-400">No history available.</div>}
            {!loadingHistory && history && (
              <div className="flex flex-col gap-2">
                {history.map((h: any) => (
                  <div key={h.id} className="flex items-center justify-between border border-neutral-100 rounded-lg p-3">
                    <div>
                      <span className={`text-[10.5px] font-medium rounded-full px-2 py-0.5 border ${STATUS_STYLE[h.status as ObservationStatus]}`}>
                        {STATUS_LABEL[h.status as ObservationStatus]}
                      </span>
                      {h.evidence_text && <div className="text-[12px] text-neutral-500 mt-1.5">{h.evidence_text}</div>}
                    </div>
                    <div className="text-[11px] text-neutral-400 shrink-0">
                      {h.checked_at ? new Date(h.checked_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "Queued"}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button onClick={() => setDetail(null)} className="mt-6 w-full h-10 rounded-full border border-neutral-200 text-[13px] font-medium">
              Close
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
