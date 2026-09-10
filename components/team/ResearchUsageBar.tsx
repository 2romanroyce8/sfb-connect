"use client";

import { useEffect, useState } from "react";
import { Gauge } from "lucide-react";

type Usage = {
  monthlyFreeCreditUsd: number;
  costPerSearchUsd: number;
  searchesUsed: number;
  costUsedUsd: number;
  remainingUsd: number;
  searchesRemainingEstimate: number | null;
  percentUsed: number;
  attempts: { found: number; notFound: number; unavailable: number; triedTotal: number };
  foundRatePercent: number | null;
};

export default function ResearchUsageBar() {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/team/research/usage")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setUsage)
      .catch(() => setError(true));
  }, []);

  if (error) return null;
  if (!usage) return null;

  const barColor = usage.percentUsed >= 90 ? "#FF453A" : usage.percentUsed >= 60 ? "#FFD60A" : "#30D158";

  return (
    <div className="rounded-[10px] px-4 py-3 mb-4" style={{ background: "#0E0E0F", border: "1px solid rgba(255,255,255,0.07)" }}>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-[11.5px] text-[#A1A1A6]">
          <Gauge size={13} />
          <span>
            Search budget this month — {usage.searchesUsed} searches used (${usage.costUsedUsd.toFixed(2)} of $
            {usage.monthlyFreeCreditUsd.toFixed(0)})
          </span>
        </div>
        {usage.foundRatePercent !== null && (
          <span className="text-[11px] text-[#6E6E73]">
            Found a real website {usage.foundRatePercent}% of the time it actually searched ({usage.attempts.found}/{usage.attempts.triedTotal})
            {usage.attempts.unavailable > 0 && `, ${usage.attempts.unavailable} couldn't search at all`}
          </span>
        )}
      </div>
      <div className="h-[6px] rounded-full mt-2.5 overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${usage.percentUsed}%`, background: barColor }} />
      </div>
      <div className="text-[10.5px] text-[#6E6E73] mt-1.5">
        {usage.searchesRemainingEstimate !== null
          ? `~${usage.searchesRemainingEstimate.toLocaleString()} free searches left this cycle at $${usage.costPerSearchUsd.toFixed(3)}/search — after that, it costs real money to keep searching.`
          : "Cost per search not configured."}
      </div>
    </div>
  );
}
