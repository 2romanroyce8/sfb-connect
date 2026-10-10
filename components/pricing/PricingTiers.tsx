"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { TIERS, NICHES, LAUNCH_PRICING_TAG, PRICING_NOTE, fmtUsd, type BillingInterval, type Tier } from "@/lib/agentProgram/config";
import { priceDisplay, creditsMath, OFFERS } from "@/lib/agentProgram/pricing";
import AgentCheckout from "@/components/agent/AgentCheckout";
import { trackMarketingEvent } from "@/lib/marketingEvents";

/**
 * §2 + §3 — Trial / Solo / Agency cards with a Monthly | Annual toggle and
 * the four-line offer block on every card. Numbers: config only. The
 * strikethrough "was" price and the "Launch pricing" tag render ONLY when
 * ANCHOR_WAS_USD has a value (Rome's blank — never invented).
 */
const INCLUDES: Record<Tier["key"], string[]> = {
  trial: ["Demo business on stock data", "Pick 3 capabilities to watch", "Receipt for every action", "Dashboard & reports", "No card, no real sends"],
  solo: ["1 real business", "All 8 capabilities", "Live integrations", "Shared human overseer", "Monthly credit refill", "Receipt for every action"],
  agency: ["5 white-labeled client spaces", "All 8 capabilities per space", "Credits pooled across spaces", "Dedicated human overseer", "Live integrations per space", "Your logo on everything"],
};

function Toggle({ value, onChange }: { value: BillingInterval; onChange: (v: BillingInterval) => void }) {
  const btn = (v: BillingInterval, label: string) => (
    <button type="button" onClick={() => onChange(v)} aria-pressed={value === v} className="h-[36px] px-5 rounded-full text-[13px] font-semibold transition-colors" style={{ background: value === v ? "#fff" : "transparent", color: value === v ? "#000" : "rgba(255,255,255,0.7)" }}>{label}</button>
  );
  return (
    <div className="inline-flex items-center p-1 rounded-full" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}>
      {btn("month", "Monthly")}{btn("year", "Annual · 2 months free")}
    </div>
  );
}

function Offer({ k }: { k: Tier["key"] }) {
  const o = OFFERS[k];
  const row = (label: string, text: string) => (
    <div>
      <div className="text-[10.5px] font-semibold tracking-[0.14em] uppercase text-[#30D158]">{label}</div>
      <p className="mt-1 text-[13px] leading-[1.55] text-white/[0.72]">{text}</p>
    </div>
  );
  return (
    <div className="mt-6 pt-6 flex flex-col gap-4" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
      <div>
        <div className="text-[10.5px] font-semibold tracking-[0.14em] uppercase text-white/[0.45]">The problem</div>
        <p className="mt-1 text-[13px] leading-[1.55] text-white/[0.72]">{o.problem}</p>
      </div>
      {row(o.timeLabel, o.time)}
      {row(o.moneyLabel, o.money)}
      {row(o.makesLabel, o.makes)}
    </div>
  );
}

export default function PricingTiers() {
  const [interval, setInterval] = useState<BillingInterval>("month");
  const change = (v: BillingInterval) => { setInterval(v); trackMarketingEvent("pricing_billing_toggle", { interval: v }); };
  return (
    <section className="px-6 py-16 md:py-20 scroll-mt-24" id="plans">
      <div className="max-w-[1180px] mx-auto">
        <div className="flex flex-col items-center text-center gap-5">
          <h2 className="text-[34px] md:text-[48px] font-bold tracking-[-0.04em] leading-[1]">Pick your plan</h2>
          <Toggle value={interval} onChange={change} />
          <p className="text-[12.5px] text-white/[0.45]">Annual is billed once a year. The setup fee is one-time and is never discounted.</p>
        </div>

        <div className="mt-10 grid lg:grid-cols-3 gap-5 items-start">
          {TIERS.map((t) => {
            const featured = "featured" in t && t.featured;
            const pd = priceDisplay(t, interval);
            return (
              <div key={t.key} onClick={() => trackMarketingEvent("pricing_card_click", { tier: t.key, interval })} className="sfb-glass relative rounded-[22px] px-6 pt-7 pb-7 flex flex-col" style={{ borderColor: featured ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.13)" }}>
                {pd.wasUsd !== null && (
                  <span className="absolute -top-3 left-6 inline-flex items-center h-[24px] px-3 rounded-full text-[11px] font-semibold text-black bg-[#30D158]">{LAUNCH_PRICING_TAG}</span>
                )}
                <div className="text-[13px] font-semibold tracking-[0.1em] uppercase text-white/[0.6]">{t.name}</div>
                <div className="mt-3 flex items-end gap-2 flex-wrap">
                  {pd.wasUsd !== null && <span className="text-[20px] text-white/[0.35] line-through mb-1">{fmtUsd(pd.wasUsd)}</span>}
                  <span className="text-[44px] md:text-[50px] font-semibold tracking-[-0.04em] leading-none text-white">{pd.headline === 0 ? "Free" : fmtUsd(pd.headline)}</span>
                  {pd.unit && <span className="text-[16px] text-white/[0.5] mb-1.5">{pd.unit}</span>}
                </div>
                {pd.billedLine && <div className="mt-2 text-[12.5px] text-white/[0.5]">{pd.billedLine}</div>}
                <div className="mt-1 text-[14px] text-white/[0.85] font-medium">{pd.setupLine}</div>
                <div className="mt-3 inline-flex self-start items-center h-[26px] px-3 rounded-full text-[12px] font-medium" style={{ background: "rgba(48,209,88,0.12)", color: "#30D158", border: "1px solid rgba(48,209,88,0.25)" }}>{creditsMath(t)}</div>

                <ul className="mt-6 flex flex-col gap-[9px] text-[13.5px]">
                  {INCLUDES[t.key].map((x) => (
                    <li key={x} className="flex items-start gap-2 text-white/[0.88]"><Check size={14} strokeWidth={2.4} className="shrink-0 mt-[3px]" style={{ color: "rgba(255,255,255,0.7)" }} /><span>{x}</span></li>
                  ))}
                </ul>

                <Offer k={t.key} />

                <div className="mt-7">
                  {t.monthlyUsd === 0 ? (
                    <Link href="/start" onClick={() => trackMarketingEvent("trial_signup_start", { from: "pricing_page" })} className="w-full inline-flex justify-center items-center h-[44px] rounded-full text-[13.5px] font-semibold text-white hover:bg-white/[0.06]" style={{ border: "1px solid rgba(255,255,255,0.2)" }}>Try it free →</Link>
                  ) : (
                    <AgentCheckout plan={t} interval={interval} />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-8 text-center text-[12.5px] text-white/[0.45]">
          {PRICING_NOTE} {NICHES.filter((n) => !n.shown).map((n) => `${n.name} ×${n.multiplier.toFixed(1)}`).join(" · ")}.
        </p>
      </div>
    </section>
  );
}
