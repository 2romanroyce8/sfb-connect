import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import MkShell from "@/components/mk/MkShell";
import { Section, Faq, CtaBand } from "@/components/mk/MkParts";
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
    <section className="mx-auto max-w-[1180px] px-5 pb-20 pt-32 md:px-8 md:pt-40">
      <div className="mx-auto mb-12 max-w-xl text-center">
        <span className="mk-chip">Pricing</span>
        <h1 className="mt-5 text-[clamp(2.6rem,6vw,4.5rem)]" style={{ fontWeight: 500 }}>Simple, transparent pricing.</h1>
        <p className="mx-auto mt-5 max-w-md leading-relaxed text-[var(--mk-muted)]">One plan for your agency workspace. Client builds are quoted separately at wholesale, and you set your own retail price.</p>
        <span className="mk-chip mt-6">Monthly plan</span>
      </div>
      <div className="mx-auto grid max-w-md items-center gap-5 lg:max-w-none lg:grid-cols-[1fr_1.15fr_1fr]">
        <article className="mk-card p-6 md:p-7 lg:order-2" style={{ borderColor: "var(--mk-blue)" }}>
          <div className="rounded-2xl border border-[var(--mk-border)] bg-gradient-to-br from-[#233e2a] via-[#181818] to-[#181818] p-6">
            <h2 className="text-2xl">Agency plan</h2>
            <p className="mt-4"><strong className="text-5xl tracking-tight">$49</strong><span className="ml-1 text-sm text-[var(--mk-muted)]">/ month</span></p>
            <p className="mt-4 text-sm leading-relaxed text-[var(--mk-muted)]">Billing is off for now. Creating a workspace is free.</p>
            <Link href="/signup" className="mk-btn mk-btn-primary mt-6 w-full">Start Your Agency</Link>
          </div>
          <ul className="mt-6 space-y-3 text-sm text-[var(--mk-text)]">{INCLUDED.filter((item) => item.live).map((item) => (
            <li key={item.text} className="flex items-start gap-3"><Check size={16} className="mt-0.5 shrink-0 text-[var(--mk-blue)]" aria-hidden /><span>{item.text}</span></li>
          ))}</ul>
        </article>
        <article className="mk-card p-6 md:p-7 lg:order-1">
          <h2 className="text-xl">Platform limits</h2>
          <dl className="mt-3">{LIMITS.map(([label, value]) => (
            <div key={label} className="mk-table-row"><dt className="text-[var(--mk-muted)]">{label}</dt><dd className="shrink-0 text-right font-medium">{value}</dd></div>
          ))}</dl>
        </article>
        <article className="mk-card p-6 md:p-7 lg:order-3">
          <h2 className="text-xl">Client builds</h2>
          <p className="mt-4 text-sm leading-relaxed text-[var(--mk-muted)]">Client builds are quoted per order at wholesale when ordering opens. Usage such as voice minutes is metered against your limits.</p>
          <Link href="#calculator" className="mk-btn mk-btn-ghost mt-6 w-full">Try the calculator</Link>
          <div className="mt-6 border-t border-[var(--mk-border)] pt-5">
            <h3 className="text-sm">Coming next</h3>
            <ul className="mt-3 space-y-3 text-sm text-[var(--mk-muted)]">{INCLUDED.filter((item) => !item.live).map((item) => <li key={item.text}>{item.text}</li>)}</ul>
          </div>
        </article>
      </div>
    </section>
    <Section id="calculator" tint eyebrow="Pricing calculator" title="Set your retail price from your cost." lead="Enter your own wholesale cost and markup. The math is shown. The defaults are placeholders, not SFB Connect prices."><PricingCalc /></Section>
    <Section eyebrow="Questions" title="Pricing FAQ"><Faq items={PRICING_FAQ} /></Section>
    <CtaBand />
  </MkShell>);
}
