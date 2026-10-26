import type { Metadata } from "next";
import MkShell from "@/components/mk/MkShell";
import { PageHero, Section, CardGrid, Steps, Faq, CtaBand } from "@/components/mk/MkParts";
import Link from "next/link";
import { PRICING_FAQ } from "@/components/mk/content";
export const metadata: Metadata = { title: "Pricing", description: "$49 per month for the agency platform. Client builds are quoted at wholesale rates; you set your own retail price.", alternates: { canonical: "/pricing" } };
export default function Page() {
  return (<MkShell>
    <PageHero eyebrow="Pricing" title="$49 a month for the platform." lead="Client builds you order are quoted at wholesale. Raise what you charge; the difference is your margin." ctas={[{ href: "/signup", label: "Start Your Agency" }, { href: "/resources", label: "Pricing calculator" }]} />
    <Section>
      <div className="grid gap-4 md:grid-cols-2 max-w-[920px]">
        <div className="mk-card p-8"><div className="text-[13px] uppercase tracking-wide" style={{ color: "var(--mk-blue2)" }}>Agency workspace</div><div className="text-[44px] font-semibold mt-2">$49<span className="text-[16px] font-normal" style={{ color: "var(--mk-muted)" }}> / month</span></div>
          <ul className="mt-5 flex flex-col gap-2.5 text-[14.5px]" style={{ color: "var(--mk-muted)" }}>{["Agency-branded workspace", "AI demo builder and published demo links", "CRM, pipeline and follow-ups", "Client portal and onboarding", "Fulfillment tracking", "Team roles and permissions"].map((x) => <li key={x}>✓ {x}</li>)}</ul>
          <Link href="/signup" className="mk-btn mk-btn-primary mt-7 w-full">Start Your Agency</Link></div>
        <div className="mk-card p-8"><div className="text-[13px] uppercase tracking-wide" style={{ color: "var(--mk-blue2)" }}>Client builds</div><div className="text-[28px] font-semibold mt-2">Wholesale, quoted per order</div>
          <p className="mt-4 text-[14.5px] leading-relaxed" style={{ color: "var(--mk-muted)" }}>Choose a service from the catalog and add the client. You receive a cost estimate or custom quote before anything starts, then set your own retail price. Usage-based items such as voice minutes are metered.</p>
          <Link href="/services" className="mk-btn mk-btn-ghost mt-7 w-full">Browse the catalog</Link></div>
      </div>
    </Section>
    <Section tint eyebrow="Questions" title="Pricing FAQ"><Faq items={PRICING_FAQ} /></Section>
    <CtaBand />
  </MkShell>);
}
