"use client";

import Link from "next/link";
import { TIERS, fmtUsd } from "@/lib/agentProgram/config";
import AgentCheckout from "@/components/agent/AgentCheckout";
import { trackMarketingEvent } from "@/lib/marketingEvents";

const card: React.CSSProperties = { background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" };

/** Trial / Solo / Agency — rendered from the single config; Solo highlighted. */
export default function AgentTiersRow() {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-[18px] items-stretch">
      {TIERS.map((t, i) => { const featured = "featured" in t && t.featured; return (
        <div key={t.key} onClick={() => trackMarketingEvent("pricing_card_click", { tier: t.key })} className="rounded-[16px] p-7 flex flex-col" style={{ ...card, borderColor: featured ? "rgba(66,227,109,0.5)" : "rgba(255,255,255,0.08)" }}>
          <div className="flex items-center justify-between"><div className="text-[13px] font-semibold uppercase tracking-[0.12em] text-white/[0.5]">{t.name}</div>{featured && <span className="text-[10px] font-semibold uppercase tracking-wide text-[#42E36D]">Most popular</span>}</div>
          <div className="mt-4 flex items-baseline gap-1.5"><span className="text-[40px] font-bold tracking-[-0.04em] leading-none text-white">{t.monthlyUsd ? fmtUsd(t.monthlyUsd) : "Free"}</span>{t.monthlyUsd > 0 && <span className="text-[13px] text-white/[0.4]">/ month</span>}</div>
          {i > 0 && <div className="mt-3 text-[12px] text-white/[0.45]">Everything in {TIERS[i - 1].name}, plus…</div>}
          <dl className="mt-5 flex flex-col gap-2.5 text-[13.5px] text-white">
            {[["Credits", t.creditsLabel], ["Businesses", t.businessesLabel], ["Capabilities", t.capabilitiesLabel], ["Integrations", t.integrations], ["Human overseer", t.overseer], ["Onboarding (one-time)", t.onboardingUsd ? fmtUsd(t.onboardingUsd) : "—"], ["Expiry", t.expiry]].map(([k, v]) => <div key={k} className="flex justify-between gap-4"><dt className="text-white/[0.5]">{k}</dt><dd className="font-medium text-right">{v}</dd></div>)}
          </dl>
          {t.monthlyUsd === 0 ? <Link href="/start" onClick={() => trackMarketingEvent("trial_signup_start", { from: "pricing" })} className="mt-8 inline-flex justify-center items-center px-5 py-3 rounded-full text-[13.5px] font-semibold text-white hover:bg-white/[0.05]" style={{ border: "1px solid rgba(255,255,255,0.16)" }}>Try it free →</Link> : <AgentCheckout plan={t} />}
        </div>); })}
    </div>
  );
}
