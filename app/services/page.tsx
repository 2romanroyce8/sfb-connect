import type { Metadata } from "next";
import MkShell from "@/components/mk/MkShell";
import { PageHero, Section, CardGrid, Steps, Faq, CtaBand } from "@/components/mk/MkParts";
import { SERVICES } from "@/components/mk/content";
export const metadata: Metadata = { title: "Service catalog", description: "Fifteen AI-powered services you can sell and deliver under your own brand.", alternates: { canonical: "/services" } };
export default function Page() {
  return (<MkShell>
    <PageHero eyebrow="Service catalog" title="Fifteen services. Your brand. Your price." lead="What you will be able to order for your clients. Ordering, wholesale quotes and delivery tracking open in the workspace next." />
    <Section eyebrow="The catalog" title="What you can sell."><CardGrid items={SERVICES} /></Section>
    <Section tint eyebrow="How ordering works" title="How ordering will work." lead="Coming next: draft, quoted, awaiting approval, onboarding, in development, QA, client review, live, maintenance. Cost estimates and wholesale rates appear inside your workspace when you order." />
    <CtaBand />
  </MkShell>);
}
