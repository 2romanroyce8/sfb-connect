import type { Metadata } from "next";
import MkShell from "@/components/mk/MkShell";
import { PageHero, Section, CardGrid, Steps, Faq, CtaBand } from "@/components/mk/MkParts";
import { SERVICES } from "@/components/mk/content";
export const metadata: Metadata = { title: "Service catalog", description: "Fifteen AI-powered services you can sell and deliver under your own brand.", alternates: { canonical: "/services" } };
export default function Page() {
  return (<MkShell>
    <PageHero eyebrow="Service catalog" title="Fifteen services. Your brand. Your price." lead="Pick the work, add the client, review the cost estimate and approve the order. Delivery is tracked from quote to live." />
    <Section eyebrow="The catalog" title="What you can sell."><CardGrid items={SERVICES} /></Section>
    <Section tint eyebrow="How ordering works" title="From draft to live, with real states." lead="Draft, quoted, awaiting approval, onboarding, in development, QA, client review, live, maintenance. Cost estimates and wholesale rates appear inside your workspace when you order." />
    <CtaBand />
  </MkShell>);
}
