import type { Metadata } from "next";
import MkShell from "@/components/mk/MkShell";
import { PageHero, Section, CardGrid, Steps, Faq, CtaBand } from "@/components/mk/MkParts";
import PricingCalc from "@/components/mk/PricingCalc";
import DemoStage from "@/components/mk/DemoStage";
export const metadata: Metadata = { title: "Resources", description: "Free pricing and ROI calculators for AI agencies.", alternates: { canonical: "/resources" } };
export default function Page() {
  return (<MkShell>
    <PageHero eyebrow="Resources" title="Tools you can use today, no account needed." lead="Work out your retail price and margin, and show a prospect a transparent ROI estimate." ctas={[{ href: "/signup", label: "Start Your Agency" }, { href: "/pricing", label: "See pricing" }]} />
    <Section eyebrow="Pricing calculator" title="Set your retail price from your cost." lead="Enter your own wholesale cost and markup. The math is shown."><PricingCalc /></Section>
    <Section tint eyebrow="ROI calculator" title="Show the opportunity, with the assumptions." lead="Use the ROI tab. The demo tabs next to it are labeled simulations."><DemoStage /></Section>
    <CtaBand />
  </MkShell>);
}
