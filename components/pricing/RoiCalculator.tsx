"use client";

import { useMemo, useState, useEffect } from "react";
import { PAID_TIERS, CREDITS_PER_BOOKED_CALL, fmtUsd } from "@/lib/agentProgram/config";
import { roiEstimate, fmtCustomers } from "@/lib/agentProgram/pricing";
import { trackMarketingEvent } from "@/lib/marketingEvents";

/**
 * §4 — the visitor types what one customer is worth and their close rate,
 * picks a tier, and sees the math live. Inputs start EMPTY: no invented
 * defaults, nothing shown until both numbers are in.
 */
export default function RoiCalculator() {
  const [worth, setWorth] = useState("");
  const [close, setClose] = useState("");
  const [tierKey, setTierKey] = useState<"solo" | "agency">("solo");
  const num = (s: string) => (s.trim() === "" ? null : Number(s.replace(/[,$%\s]/g, "")));
  const result = useMemo(() => roiEstimate({ customerValueUsd: num(worth), closeRatePct: num(close), tierKey }), [worth, close, tierKey]);

  useEffect(() => {
    if (!result) return;
    const id = setTimeout(() => trackMarketingEvent("roi_calculated", { tier: tierKey, customers: result.customers, revenueUsd: result.revenueUsd }), 800);
    return () => clearTimeout(id);
  }, [result, tierKey]);

  const field = "h-[48px] w-full rounded-[10px] px-4 text-[16px] outline-none text-white placeholder:text-white/[0.3]";
  const fieldStyle = { background: "#0F0F0F", border: "1px solid rgba(255,255,255,0.14)" };

  return (
    <section className="px-6 py-16 md:py-20 scroll-mt-24" id="roi">
      <div className="max-w-[1100px] mx-auto rounded-[22px] p-7 md:p-10" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[#30D158] mb-4">Do the math</div>
        <h2 className="text-[30px] md:text-[40px] font-bold tracking-[-0.035em] leading-[1.05]">What is one customer worth to you?</h2>
        <p className="mt-3 text-[14px] text-white/[0.55] max-w-[640px]">Type two numbers. We assume 1 booked call ≈ {CREDITS_PER_BOOKED_CALL} credits, so a plan&apos;s monthly credits become a number of calls, your close rate turns calls into customers, and your customer value turns that into dollars.</p>

        <div className="mt-8 grid md:grid-cols-3 gap-4">
          <label className="flex flex-col gap-2 text-[12.5px] text-white/[0.6]">One customer is worth
            <input inputMode="decimal" value={worth} onChange={(e) => setWorth(e.target.value)} placeholder="$ e.g. the average job" className={field} style={fieldStyle} aria-label="Value of one customer in dollars" />
          </label>
          <label className="flex flex-col gap-2 text-[12.5px] text-white/[0.6]">I close
            <input inputMode="decimal" value={close} onChange={(e) => setClose(e.target.value)} placeholder="% of booked calls" className={field} style={fieldStyle} aria-label="Close rate percent" />
          </label>
          <div className="flex flex-col gap-2 text-[12.5px] text-white/[0.6]">Plan
            <div className="grid grid-cols-2 p-1 rounded-[10px] h-[48px]" style={fieldStyle}>
              {PAID_TIERS.map((t) => (
                <button key={t.key} type="button" onClick={() => setTierKey(t.key as "solo" | "agency")} aria-pressed={tierKey === t.key} className="rounded-[8px] text-[13.5px] font-semibold transition-colors" style={{ background: tierKey === t.key ? "#fff" : "transparent", color: tierKey === t.key ? "#000" : "rgba(255,255,255,0.7)" }}>{t.name}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-[14px] p-6" style={{ background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.14)" }} aria-live="polite">
          {result ? (
            <>
              <div className="text-[24px] md:text-[32px] font-semibold tracking-[-0.03em] leading-tight text-white">
                ≈ {result.calls} booked calls → ≈ {fmtCustomers(result.customers)} new customers → <span className="text-[#30D158]">≈ {fmtUsd(result.revenueUsd)}/mo</span>
              </div>
              <div className="mt-3 text-[13.5px] text-white/[0.6]">
                On a {fmtUsd(result.costUsd)}/mo plan that is {result.netUsd >= 0 ? <>≈ <strong className="text-white">{fmtUsd(result.netUsd)}</strong> more than the agent costs each month.</> : <>≈ <strong className="text-white">{fmtUsd(-result.netUsd)}</strong> short of covering the plan — try a higher close rate or customer value, or start with the free trial.</>}
              </div>
              <div className="mt-2 text-[11.5px] text-white/[0.4]">Planning math, not a promise. Credits pay for work done, not outcomes.</div>
            </>
          ) : (
            <div className="text-[15px] text-white/[0.45]">Your numbers go above. The result appears here as soon as both are in.</div>
          )}
        </div>
      </div>
    </section>
  );
}
