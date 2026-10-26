import type { Metadata } from "next";
import MkShell from "@/components/mk/MkShell";
import { PageHero, Section, CardGrid, Steps, Faq, CtaBand } from "@/components/mk/MkParts";
import { INDUSTRIES } from "@/components/mk/content";
export const metadata: Metadata = { title: "Industry solutions", description: "Demo configurations for home services, health and beauty, professional services and hospitality.", alternates: { canonical: "/solutions" } };
const GROUPS = [
  { title: "Home services", body: "HVAC, plumbing, roofing, electricians, landscaping, junk removal, cleaning, home remodeling, general contractors." },
  { title: "Automotive", body: "Auto detailing." },
  { title: "Health and beauty", body: "Dental offices, med spas, salons, fitness studios." },
  { title: "Professional and property", body: "Real estate, legal services." },
  { title: "Hospitality", body: "Restaurants." },
];
export default function Page() {
  return (<MkShell>
    <PageHero eyebrow="Solutions" title="Start from the trade, not a blank page." lead={`${INDUSTRIES.length} industry configurations, each with typical services, common questions and qualifying questions. Add your own without writing code.`} />
    <Section eyebrow="Industries" title="What's available today."><CardGrid items={GROUPS} /></Section>
    <Section tint eyebrow="Every configuration includes" title="The parts a good demo needs."><CardGrid cols={4} items={[{ title: "Typical services", body: "What businesses in the trade actually sell." }, { title: "Common questions", body: "What customers ask first." }, { title: "Qualifying questions", body: "What the business needs to know before booking." }, { title: "Disclaimers", body: "Plain wording that marks simulations as simulations." }]} /></Section>
    <Section eyebrow="Not on the list?" title="Use the industry-neutral configuration, or add your own." lead="Admins can add industries and edit them without a code change." />
    <CtaBand />
  </MkShell>);
}
