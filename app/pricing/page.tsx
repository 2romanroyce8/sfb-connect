import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import MkShell from "@/components/mk/MkShell";
import { PageHero, Section, Faq, CtaBand } from "@/components/mk/MkParts";
import PricingCalc from "@/components/mk/PricingCalc";
import { PRICING_FAQ } from "@/components/mk/content";
export const metadata: Metadata = { title: "Pricing", description: "$49 per month for the agency platform. Client builds are quoted at wholesale rates; you set your own retail price.", alternates: { canonical: "/pricing" } };

// Every row in "The limits, in full" is a number that exists in the code today (demo cap, client cap, call length). Nothing here is aspirational.
const INCLUDED: { text: string; live: boolean }[] = [
  { text: "Agency-branded workspace", live: true }, { text: "Demo builder with a published link per demo", live: true }, { text: "Demo analytics: opens and interactions", live: true },
  { text: "Live voice, chat simulation and real website audit in every demo", live: true }, { text: "CRM: prospects, pipeline, follow-ups", live: true },
  { text: "Client portal with onboarding intake and review", live: true }, { text: "Your logo, colors and booking link on every demo page", live: true },
  { text: "Fulfillment tracking and ordering", live: false }, { text: "Team roles and commission tracking", live: false },
];
const LIMITS: [string, string][] = [["Demos per agency", "25"], ["Clients per agency", "200"], ["Length of one live voice call", "3 minutes"], ["Website audits a visitor can run", "12 an hour"], ["Industries to start from", "17 + neutral"], ["Platform subscription", "$49 / month"]];

export default function Page() {
  return (<MkShell>
    <PageHero eyebrow="Pricing" title="$49 a month for the platform." lead="Billing is not switched on yet, so creating a workspace is free for now. Client builds will be quoted at wholesale, and whatever you charge above that is your margin." ctas={[{ href: "/signup", label: "Start Your Agency" }, { href: "#calculator", label: "Try the calculator" }]} />
    <Section>
      <div className="grid gap-5 lg:grid-cols-[420px_1fr] max-w-[1100px] mx-auto">
        <div className="mk-plan p-9 flex flex-col">
          <div className="flex items-baseline justify-between"><span className="text-[26px] font-medium">Agency</span><span><span className="text-[46px] font-bold tracking-tight">$49</span><span className="text-[15px]" style={{ color: "var(--mk-ink-muted)" }}> /mo</span></span></div>
          <ul className="mt-7 flex flex-col gap-3.5 text-[15px]">{INCLUDED.map((i) => <li key={i.text} className="flex gap-3 items-start" style={{ color: i.live ? "var(--mk-white)" : "var(--mk-ink-muted)" }}><Check size={18} className="shrink-0 mt-0.5" style={{ color: i.live ? "var(--mk-blue)" : "var(--mk-ink-line)" }} aria-hidden /><span>{i.text}{!i.live && <em className="not-italic text-[12px] ml-2 opacity-80">coming next</em>}</span></li>)}</ul>
          <Link href="/signup" className="mk-btn mt-9" style={{ background: "var(--mk-white)", color: "var(--mk-ink)" }}>Start Your Agency</Link>
          <p className="mt-3 text-center text-[12.5px]" style={{ color: "var(--mk-ink-muted)" }}>Billing is off for now. You are not charged.</p>
        </div>
        <div className="mk-card p-9 flex flex-col">
          <div className="text-[12px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--mk-muted)" }}>The limits, in full</div>
          <div className="mt-4">{LIMITS.map(([k, v]) => <div key={k} className="mk-table-row"><span style={{ color: "var(--mk-muted)" }}>{k}</span><span className="font-medium">{v}</span></div>)}</div>
          <p className="mt-auto pt-8 text-[13px] leading-relaxed" style={{ color: "var(--mk-muted)" }}>Client builds are quoted per order inside your workspace once ordering opens, at wholesale, and you set your own retail price. Usage-based items such as voice minutes are metered and shown against your limits.</p>
        </div>
      </div>
    </Section>
    <Section id="calculator" tint eyebrow="Pricing calculator" title="Set your retail price from your cost." lead="Enter your own wholesale cost and markup. The math is shown. The defaults are placeholders, not SFB Connect prices."><PricingCalc /></Section>
    <Section eyebrow="Questions" title="Pricing FAQ"><Faq items={PRICING_FAQ} /></Section>
    <CtaBand />
  </MkShell>);
}
