"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { TIERS, fmtUsd, type TierKey } from "@/lib/agentProgram/config";
import AgentCheckout from "@/components/agent/AgentCheckout";
import { trackMarketingEvent } from "@/lib/marketingEvents";

/**
 * Pricing cards in the frosted-glass "ladder" style (reference: 2026-10-09).
 * Every number comes from TIERS. The ladder is one shared feature list; a
 * tier either includes a rung (check, bright) or doesn't (dimmed). Nothing is
 * claimed that the product doesn't do: integrations are "live integrations",
 * not a vendor list.
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

const sub = (key: TierKey) => {
  const t = TIERS.find((x) => x.key === key)!;
  if (t.key === "trial") return `${t.credits} credits · no card · ${t.trialDays} days`;
  return `${t.creditsLabel} · one-time ${fmtUsd(t.onboardingUsd)} onboarding`;
};

export default function AgentTiersRow() {
  return (
    <div className="grid lg:grid-cols-3 gap-5 lg:gap-6 items-end">
      {TIERS.map((t) => {
        const featured = "featured" in t && t.featured;
        return (
          <div
            key={t.key}
            onClick={() => trackMarketingEvent("pricing_card_click", { tier: t.key })}
            className={`sfb-glass relative rounded-[22px] px-6 pt-8 pb-7 flex flex-col ${featured ? "lg:-translate-y-10 lg:pb-9" : ""}`}
            style={{ borderColor: featured ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.13)" }}
          >
            <div className="text-center">
              <div
                className="text-[30px] md:text-[34px] font-semibold tracking-[-0.03em] text-white"
                style={{ textShadow: featured ? "0 0 18px rgba(66,227,109,0.75), 0 0 42px rgba(66,227,109,0.35)" : "0 0 14px rgba(255,255,255,0.45)" }}
              >
                {t.name}
              </div>
              <div className="mt-2 text-[20px] text-white/[0.78] tracking-[-0.01em]">
                {t.monthlyUsd ? <>{fmtUsd(t.monthlyUsd)}<span className="text-white/[0.5]">/mo</span></> : "Free"}
              </div>
              <div className="mt-1 text-[11.5px] text-white/[0.42]">{sub(t.key)}</div>
            </div>

            <ul className="mt-7 flex flex-col items-center gap-[11px] text-[13.5px]">
              {LADDER.map((r) => {
                const v = r.in[t.key];
                const on = v !== false;
                return (
                  <li key={r.label} className="flex items-center justify-center gap-2 text-center" style={{ color: on ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.26)" }}>
                    {on && <Check size={13} strokeWidth={2.4} className="shrink-0" style={{ color: "rgba(255,255,255,0.7)" }} />}
                    <span>
                      {r.label}
                      {typeof v === "string" && <span className="text-white/[0.45]"> · {v}</span>}
                    </span>
                  </li>
                );
              })}
            </ul>

            <div className="mt-8">
              {t.monthlyUsd === 0 ? (
                <Link href="/start" onClick={() => trackMarketingEvent("trial_signup_start", { from: "pricing" })} className="w-full inline-flex justify-center items-center h-[44px] rounded-full text-[13.5px] font-semibold text-white hover:bg-white/[0.06]" style={{ border: "1px solid rgba(255,255,255,0.2)" }}>
                  Try it free →
                </Link>
              ) : (
                <AgentCheckout plan={t} />
              )}
            </div>
          </div>
        );
      })}
      <style jsx global>{`
        .sfb-glass {
          background:
            radial-gradient(120% 80% at 50% 0%, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.03) 45%, rgba(255, 255, 255, 0.015) 100%),
            rgba(12, 12, 12, 0.55);
          border: 1px solid rgba(255, 255, 255, 0.13);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.14), 0 30px 80px rgba(0, 0, 0, 0.55);
          backdrop-filter: blur(22px) saturate(1.2);
          -webkit-backdrop-filter: blur(22px) saturate(1.2);
        }
      `}</style>
    </div>
  );
}
