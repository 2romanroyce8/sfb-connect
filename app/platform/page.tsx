import type { Metadata } from "next";
import MkShell from "@/components/mk/MkShell";
import { PageHero, Section, CardGrid, Steps, Faq, CtaBand } from "@/components/mk/MkParts";
import { WORKSPACE, PORTAL } from "@/components/mk/content";
export const metadata: Metadata = { title: "Platform overview", description: "One workspace for demos, CRM, clients, fulfillment, automations and billing, under your own brand.", alternates: { canonical: "/platform" } };
export default function Page() {
  return (<MkShell>
    <PageHero eyebrow="Platform" title="One workspace for the whole agency." lead="Demos, prospects, clients, delivery and revenue, connected, so nothing lives in a spreadsheet or a stranger's inbox." />
    <Section eyebrow="Inside the workspace" title="Everything connected."><CardGrid items={WORKSPACE} /></Section>
    <Section tint eyebrow="Client side" title="A portal your clients can actually use."><CardGrid items={PORTAL} /></Section>
    <Section eyebrow="Isolation" title="Your data stays yours." lead="Every agency's records are isolated at the database level. Staff roles are enforced on the server. SFB Connect's own internal sales data is never visible to agencies." />
    <CtaBand />
  </MkShell>);
}
