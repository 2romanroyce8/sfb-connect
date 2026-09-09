"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { LookupResult } from "@/lib/businessLookupContext";
import { runNicheRanking, type RankingOutcome } from "@/lib/runNicheRanking";

// Real, evidence-based "AI Discovery Market Position" for the business
// that was just analyzed. Every row here is a real search result for the
// business's own verified category + location -- nothing is invented,
// and the searched business is only ever placed at a rank it actually
// holds among those results, never forced into the top five.

const CONFIDENCE_COLOR: Record<string, string> = {
  HIGH: "#30D158",
  MEDIUM: "#FFD60A",
  LOW: "#A1A1A6",
};

export default function MarketPositionPanel({ business }: { business: LookupResult }) {
  const [outcome, setOutcome] = useState<RankingOutcome | { status: "loading" } | null>(null);

  const category = business.business.category.value;
  const location = business.business.location.value;
  const website = business.business.website.value;
  const name = business.business.name.value;

  useEffect(() => {
    let cancelled = false;
    setOutcome({ status: "loading" });
    runNicheRanking({ category, location, businessName: name, businessWebsite: website }).then((res) => {
      if (!cancelled) setOutcome(res);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, location, website, name]);

  if (!outcome || outcome.status === "loading") {
    return (
      <div className="mt-3.5 p-5 rounded-2xl bg-white/[0.03] border border-white/10">
        <div className="flex items-center gap-2.5 text-[13px] text-medium-gray">
          <Loader2 size={14} className="animate-spin" />
          Comparing your business against the public market…
        </div>
      </div>
    );
  }

  if (outcome.status === "failed" || outcome.status === "unavailable") {
    return (
      <div className="mt-3.5 p-5 rounded-2xl bg-white/[0.03] border border-white/10">
        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-medium-gray mb-2">
          AI Discovery Market Position
        </div>
        <p className="text-[13px] leading-relaxed text-white/60">{outcome.message}</p>
      </div>
    );
  }

  if (outcome.status === "insufficient_evidence") {
    return (
      <div className="mt-3.5 p-5 rounded-2xl bg-white/[0.03] border border-white/10">
        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-medium-gray mb-2">
          AI Discovery Market Position
        </div>
        <p className="text-[13px] leading-relaxed text-white/60">{outcome.message}</p>
      </div>
    );
  }

  const { niche, geography, confidence, analyzedAt, topFive, yourBusiness } = outcome;

  return (
    <div className="mt-3.5 rounded-2xl bg-white/[0.03] border border-white/10 overflow-hidden">
      <div className="p-5 pb-4 border-b border-white/[0.06]">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-medium-gray mb-1">
              AI Discovery Market Position
            </div>
            <div className="text-[15px] font-medium text-white">
              {niche} — {geography}
            </div>
          </div>
          <span
            className="text-[10px] px-2.5 py-1 rounded-full border"
            style={{ color: CONFIDENCE_COLOR[confidence], borderColor: `${CONFIDENCE_COLOR[confidence]}33` }}
          >
            {confidence} CONFIDENCE
          </span>
        </div>
        <p className="mt-2 text-[12.5px] text-white/60">
          {yourBusiness.status === "top5"
            ? `${name || "Your business"} — #${yourBusiness.rank} of verified top 5`
            : yourBusiness.status === "outside"
            ? `${name || "Your business"} — outside verified top 5`
            : yourBusiness.note}
        </p>
      </div>

      <div>
        {topFive.map((c) => (
          <div
            key={c.domain}
            className="grid gap-3.5 items-center px-5 py-3.5 border-b border-white/[0.05] last:border-b-0"
            style={{ gridTemplateColumns: "28px minmax(0,1fr) auto", background: c.isYourBusiness ? "rgba(255,255,255,0.035)" : "transparent" }}
          >
            <span className="text-[16px] font-semibold text-white/80">#{c.rank}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[13.5px] font-medium text-white truncate">{c.name}</span>
                {c.isYourBusiness && (
                  <span className="shrink-0 text-[8.5px] font-semibold tracking-[0.08em] text-white/70 px-1.5 py-[3px] rounded-[4px] border border-white/20">
                    YOUR BUSINESS
                  </span>
                )}
              </div>
              <div className="text-[10.5px] text-white/35 truncate mt-0.5">{c.domain}</div>
              <div className="text-[11px] text-white/45 leading-snug mt-1 line-clamp-2">{c.reason}</div>
            </div>
          </div>
        ))}
      </div>

      {yourBusiness.status !== "top5" && (
        <div className="px-5 py-3.5 bg-white/[0.02] border-t border-white/[0.06]">
          <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-white/40 mb-1">Your Business</div>
          <p className="text-[12px] text-white/55 leading-relaxed">{yourBusiness.note}</p>
        </div>
      )}

      <div className="px-5 py-2.5 bg-black/20 border-t border-white/[0.05]">
        <span className="text-[10px] text-white/[0.32]">
          Last checked {new Date(analyzedAt).toLocaleString()} · based on public search results, not a guaranteed AI ranking
        </span>
      </div>
    </div>
  );
}
