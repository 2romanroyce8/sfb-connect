"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronDown } from "lucide-react";
import { TIERS, NICHES, LAUNCH_PRICING_TAG, PRICING_NOTE, fmtUsd, type BillingInterval, type Tier, type TierKey } from "@/lib/agentProgram/config";
import { priceDisplay, creditsMath, OFFERS } from "@/lib/agentProgram/pricing";
import AgentCheckout from "@/components/agent/AgentCheckout";
import { trackMarketingEvent } from "@/lib/marketingEvents";

/**
 * §2 + §3, merged (Roman, 2026-10-10): the glass UI from the homepage
 * (giant "Pricing" backdrop, three frosted cards, Solo elevated with a glow
 * halo, bright vs dimmed ladder rows) carrying the overhaul's offer content
 * (Monthly | Annual toggle that moves BOTH paid cards, setup lines, green
 * concrete-math pills, THE OFFER blocks). Numbers: config only. The "was"
 * strikethrough + "Launch pricing" tag render ONLY once ANCHOR_WAS_USD is set.
 */
const LADDER: { label: string; in: Record<TierKey, boolean | string> }[] = [
  { label: "Public per-action price list", in: { trial: true, solo: true, agency: true } },
  { label: "Receipt for every action", in: { trial: true, solo: true, agency: true } },
  { label: "Human approval on customer-facing work", in: { trial: true, solo: true, agency: true } },
  { label: "Dashboard & reports", in: { trial: true, solo: true, agency: true } },
  { label: "All 8 capabilities", in: { trial: "3 to watch", solo: true, agency: true } },
  { label: "Your real business, real sends", in: { trial: false, solo: true, agency: true } },
  { label: "Live integrations", in: { trial: false, solo: true, agency: true } },
  { label: "Monthly credit refill", in: { trial: false, solo: true, agency: true } },
  { label: "Named human overseer", in: { trial: false, solo: "Shared", agency: "Dedicated" } },
  { label: "5 white-labeled client spaces", in: { trial: false, solo: false, agency: true } },
  { label: "Credits pooled across spaces", in: { trial: false, solo: false, agency: true } },
];

function Toggle({ value, onChange }: { value: BillingInterval; onChange: (v: BillingInterval) => void }) {
  const btn = (v: BillingInterval, label: string) => (
    <button type="button" onClick={() => onChange(v)} aria-pressed={value === v} className="h-[36px] px-5 rounded-full text-[13px] font-semibold transition-colors" style={{ background: value === v ? "#fff" : "transparent", color: value === v ? "#000" : "rgba(255,255,255,0.7)" }}>{label}</button>
  );
  return (
    <div className="inline-flex items-center p-1 rounded-full" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }} role="group" aria-label="Billing interval — applies to Solo and Agency">
      {btn("month", "Monthly")}{btn("year", "Annual · 2 months free")}
    </div>
  );
}

function Offer({ k, open, onToggle }: { k: Tier["key"]; open: boolean; onToggle: () => void }) {
  const o = OFFERS[k];
  const row = (label: string, text: string, muted = false) => (
    <div>
      <div className="text-[10.5px] font-semibold tracking-[0.14em] uppercase" style={{ color: muted ? "rgba(255,255,255,0.45)" : "#30D158" }}>{label}</div>
      <p className="mt-1 text-[13px] leading-[1.55] text-white/[0.72]">{text}</p>
    </div>
  );
  return (
    <div className="mt-6 pt-5" style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="w-full flex items-center justify-between text-left text-[12px] font-semibold tracking-[0.1em] uppercase text-white/[0.7]">
        <span>The offer</span><ChevronDown size={14} className="transition-transform" style={{ transform: open ? "rotate(180deg)" : "none" }} />
      </button>
      {open && (
        <div className="mt-4 flex flex-col gap-4 text-left">
          {row("The problem", o.problem, true)}
          {row(o.timeLabel, o.time)}
          {row(o.moneyLabel, o.money)}
          {row(o.makesLabel, o.makes)}
        </div>
      )}
    </div>
  );
}

export default function PricingTiers() {
  const [interval, setInterval] = useState<BillingInterval>("month");
  const [offersOpen, setOffersOpen] = useState(true);
  const change = (v: BillingInterval) => { setInterval(v); trackMarketingEvent("pricing_billing_toggle", { interval: v }); };

  return (
    <section className="relative overflow-hidden px-6 pt-10 md:pt-14 pb-16 md:pb-20 scroll-mt-24" id="plans" style={{ background: "#000" }}>
      {/* soft dot grid (homepage look) */}
      <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)", backgroundSize: "22px 22px", maskImage: "radial-gradient(ellipse at 50% 30%, rgba(0,0,0,0.9), transparent 70%)", WebkitMaskImage: "radial-gradient(ellipse at 50% 30%, rgba(0,0,0,0.9), transparent 70%)" }} />
      <div className="relative max-w-[1180px] mx-auto">
        <div className="flex flex-col items-center text-center gap-5">
          <h2 className="text-[34px] md:text-[48px] font-bold tracking-[-0.04em] leading-[1]">Pick your plan</h2>
          <Toggle value={interval} onChange={change} />
          <p className="text-[12.5px] text-white/[0.45]">Annual is billed once a year. The setup fee is one-time and is never discounted.</p>
        </div>

        <div className="relative mt-4">
          <h3 aria-hidden className="select-none text-center font-semibold leading-[0.82] tracking-[-0.06em]" style={{ fontSize: "clamp(104px, 22vw, 290px)", backgroundImage: "linear-gradient(180deg, #ffffff 0%, #d9d9d9 38%, rgba(120,120,120,0.55) 68%, rgba(0,0,0,0) 100%)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>Pricing</h3>

          <div className="relative -mt-[0.42em] lg:-mt-[0.5em] grid lg:grid-cols-3 gap-5 lg:gap-6 items-start" style={{ zIndex: 1 }}>
            {TIERS.map((t) => {
              const featured = "featured" in t && t.featured;
              const pd = priceDisplay(t, interval);
              return (
                <div
                  key={t.key}
                  onClick={() => trackMarketingEvent("pricing_card_click", { tier: t.key, interval })}
                  className={`sfb-glass relative rounded-[22px] px-6 pt-8 pb-7 flex flex-col ${featured ? "lg:-translate-y-10 lg:pb-9" : ""}`}
                  style={{ borderColor: featured ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.13)", boxShadow: featured ? "inset 0 1px 0 rgba(255,255,255,0.14), 0 30px 80px rgba(0,0,0,0.55), 0 0 90px rgba(66,227,109,0.18)" : undefined }}
                >
                  {pd.wasUsd !== null && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center h-[24px] px-3 rounded-full text-[11px] font-semibold text-black bg-[#30D158] whitespace-nowrap">{LAUNCH_PRICING_TAG}</span>
                  )}
                  <div className="text-center">
                    <div className="text-[30px] md:text-[34px] font-semibold tracking-[-0.03em] text-white" style={{ textShadow: featured ? "0 0 18px rgba(66,227,109,0.75), 0 0 42px rgba(66,227,109,0.35)" : "0 0 14px rgba(255,255,255,0.45)" }}>{t.name}</div>
                    <div className="mt-2 flex items-end justify-center gap-2 flex-wrap">
                      {pd.wasUsd !== null && <span className="text-[16px] text-white/[0.35] line-through mb-1">{fmtUsd(pd.wasUsd)}</span>}
                      <span className="text-[30px] font-semibold tracking-[-0.03em] leading-none text-white">{pd.headline === 0 ? "Free" : fmtUsd(pd.headline)}</span>
                      {pd.unit && <span className="text-[14px] text-white/[0.5] mb-1">{pd.unit}</span>}
                    </div>
                    {pd.billedLine && <div className="mt-1.5 text-[11.5px] text-white/[0.45]">{pd.billedLine}</div>}
                    <div className="mt-1 text-[13px] text-white/[0.85] font-medium">{t.monthlyUsd === 0 ? pd.setupLine : pd.setupLine}</div>
                    <div className="mt-3 inline-flex items-center h-[26px] px-3 rounded-full text-[12px] font-medium" style={{ background: "rgba(48,209,88,0.12)", color: "#30D158", border: "1px solid rgba(48,209,88,0.25)" }}>{creditsMath(t)}</div>
                  </div>

                  <ul className="mt-7 flex flex-col items-center gap-[11px] text-[13.5px]">
                    {LADDER.map((r) => {
                      const v = r.in[t.key];
                      const on = v !== false;
                      return (
                        <li key={r.label} className="flex items-center justify-center gap-2 text-center" style={{ color: on ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.26)" }}>
                          {on && <Check size={13} strokeWidth={2.4} className="shrink-0" style={{ color: "rgba(255,255,255,0.7)" }} />}
                          <span>{r.label}{typeof v === "string" && <span className="text-white/[0.45]"> · {v}</span>}</span>
                        </li>
                      );
                    })}
                  </ul>

                  <Offer k={t.key} open={offersOpen} onToggle={() => setOffersOpen((o) => !o)} />

                  <div className="mt-8">
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
        </div>

        <p className="mt-10 text-center text-[12.5px] text-white/[0.45]">
          {PRICING_NOTE} {NICHES.filter((n) => !n.shown).map((n) => `${n.name} ×${n.multiplier.toFixed(1)}`).join(" · ")}.
        </p>
      </div>
    </section>
  );
}
