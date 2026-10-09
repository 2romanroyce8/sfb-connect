"use client";

import Link from "next/link";
import { CAPABILITIES, CREDIT_PRICES, TOP_UP_PACKS, FREE_ACTIONS, CREDITS_PER_BOOKED_CALL, CREDITS_PAY_FOR_WORK, TIERS, bookedCallsFor, fmtUsd } from "@/lib/agentProgram/config";
import { trackMarketingEvent } from "@/lib/marketingEvents";

const card: React.CSSProperties = { background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" };

// Replaces the old "SFB Action Credits / Need SFB to do more?" panel. Every
// number renders from lib/agentProgram/config.ts -- the same source the
// dashboard and checkout use.
export default function CreditsSection() {
  const groups = [...CAPABILITIES.map((c) => ({ name: c.name, prices: CREDIT_PRICES.filter((p) => p.capability === c.key) })), { name: "Human", prices: CREDIT_PRICES.filter((p) => p.capability === "human") }];
  return (
    <section id="credits" className="py-20 md:py-28 px-6 scroll-mt-24" style={{ background: "#000" }}>
      <div className="max-w-[1180px] mx-auto">
        <div className="grid md:grid-cols-[0.9fr_1.1fr] gap-10 md:gap-16 items-start">
          <div>
            <span className="font-mono text-xs tracking-[0.18em] uppercase text-medium-gray mb-5 block">Credits — the fuel</span>
            <h2 className="text-[32px] sm:text-[40px] md:text-[56px] font-extrabold tracking-[-0.025em] leading-[1.06]">What your credits buy.</h2>
            <p className="mt-5 text-[16px] leading-relaxed text-[#a3a3a8] max-w-[560px]">One credit type. Simple tasks cost little, big builds cost more — and every action shows its receipt in your dashboard.</p>
            <div className="mt-6 rounded-[12px] p-5" style={card}>
              <div className="text-[11px] uppercase tracking-wide text-white/[0.4] mb-2">Planning math</div>
              <div className="text-[14px] text-white/[0.75]">One booked call — prospect sourced, enriched, messaged, replied, booked — ≈ <span className="text-white font-semibold">{CREDITS_PER_BOOKED_CALL} credits</span>.</div>
              <ul className="mt-3 text-[13px] text-white/[0.55] flex flex-col gap-1">{TIERS.map((t) => <li key={t.key}><span className="text-white">{t.name}:</span> ≈ {bookedCallsFor(t.credits)} fully-worked prospects{t.monthlyUsd > 0 ? " / month" : ""}</li>)}</ul>
              <div className="mt-3 text-[12px] text-white/[0.4]">{CREDITS_PAY_FOR_WORK} Free (0 credits): {FREE_ACTIONS.join(", ").toLowerCase()}.</div>
            </div>
            <div className="mt-6 grid gap-2.5">
              {TOP_UP_PACKS.map((p) => (
                <Link key={p.name} href="/start" onClick={() => trackMarketingEvent("topup_click", { credits: p.credits })} className="rounded-[12px] p-4 flex items-center justify-between hover:bg-white/[0.03] transition-colors" style={card}>
                  <div><div className="text-[14px] font-semibold">{p.name}</div><div className="text-[11.5px] text-white/[0.45]">Top-up · never expires while your membership is active</div></div>
                  <div className="text-[18px] font-bold tracking-[-0.03em]">{fmtUsd(p.usd)}</div>
                </Link>
              ))}
            </div>
          </div>
          <div className="rounded-[14px] overflow-hidden" style={card}>
            <div className="px-5 py-3 text-[11px] uppercase tracking-wide text-white/[0.4]" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Public credit price list · same numbers in your dashboard</div>
            {groups.map((g) => (
              <div key={g.name} className="px-5 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="text-[12px] font-semibold text-white/[0.8] mb-1.5">{g.name}</div>
                <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-0.5">{g.prices.map((p) => <li key={p.key} className="flex justify-between text-[12.5px]"><span className="text-white/[0.55]">{p.label}</span><span className="tabular-nums text-white/[0.85]">{p.credits}</span></li>)}</ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
