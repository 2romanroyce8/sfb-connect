import type { Metadata } from "next";
import MkShell from "@/components/mk/MkShell";
import { PageHero, Section, CardGrid, Steps, Faq, CtaBand } from "@/components/mk/MkParts";
export const metadata: Metadata = { title: "About", description: "SFB Connect is the software division of Six Figure Blueprints, part of RR Empire Co.", alternates: { canonical: "/about" } };
export default function Page() {
  return (<MkShell>
    <PageHero eyebrow="About" title="Software built by people who sell it." lead="SFB Connect is the software division of Six Figure Blueprints, part of RR Empire Co. We built the tools we needed to sell and deliver AI services, and we're opening them to other agencies." ctas={[{ href: "/signup", label: "Start Your Agency" }, { href: "/contact", label: "Contact us" }]} />
    <Section eyebrow="What we believe" title="Simple rules."><CardGrid items={[
      { title: "Real workflows, not mockups", body: "If a feature is on the page, it works, or it says plainly that it is a simulation." },
      { title: "No promised results", body: "Estimates show their formulas and assumptions." },
      { title: "Your clients are yours", body: "Isolated data, your branding, your pricing." },
    ]} /></Section>
    <CtaBand />
  </MkShell>);
}
