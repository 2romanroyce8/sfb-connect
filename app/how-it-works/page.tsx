import type { Metadata } from "next";
import MkShell from "@/components/mk/MkShell";
import { PageHero, Section, CardGrid, Steps, Faq, CtaBand } from "@/components/mk/MkParts";
import { HOME_STEPS } from "@/components/mk/content";
export const metadata: Metadata = { title: "How it works", description: "Build, brand, publish, sell, onboard, fulfill and manage.", alternates: { canonical: "/how-it-works" } };
export default function Page() {
  return (<MkShell>
    <PageHero eyebrow="How it works" title="From first demo to delivered system." lead="The same connected path every time, so you spend your time selling instead of stitching tools together." />
    <Section eyebrow="Selling" title="Build, brand, publish, sell."><Steps items={HOME_STEPS} /></Section>
    <Section tint eyebrow="Delivering" title="Onboard, fulfill, support, bill."><Steps items={[{ title: "Onboard", body: "Collect business details, services, hours and approvals through a structured intake." }, { title: "Fulfill", body: "The order moves through quote, development and QA with tasks and milestones." }, { title: "Launch", body: "The client reviews, approves and goes live. Maintenance begins." }, { title: "Manage", body: "Track usage, revenue and margin per client from your workspace." }]} /></Section>
    <CtaBand />
  </MkShell>);
}
