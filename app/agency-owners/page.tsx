import type { Metadata } from "next";
import MkShell from "@/components/mk/MkShell";
import { PageHero, Section, CardGrid, Steps, Faq, CtaBand } from "@/components/mk/MkParts";
export const metadata: Metadata = { title: "For agency owners", description: "Launch and run an AI agency under your own brand.", alternates: { canonical: "/agency-owners" } };
export default function Page() {
  return (<MkShell>
    <PageHero eyebrow="Agency owners" title="Run an AI agency without building the back office." lead="Your brand on the demos and the client portal. Your price on every service. One workspace for sales, delivery and the numbers." />
    <Section eyebrow="What you get" title="Built around how an agency makes money."><CardGrid items={[
      { title: "Your own prices", body: "Wholesale cost, your retail price, setup fee and monthly charge are tracked separately, with gross margin shown per client." },
      { title: "Demos that sell", body: "Personalized, branded demos with a trackable link." },
      { title: "A pipeline that matches your process", body: "Default stages from New Lead to Won, customizable." },
      { title: "A team you can grow", body: "Invite sales and fulfillment staff with roles, ownership and activity logs." },
      { title: "Client-ready delivery", body: "Onboarding, a client portal and a fulfillment queue for every order." },
      { title: "Cost controls", body: "Usage is tracked with limits and warnings so paid infrastructure can't run away." },
    ]} /></Section>
    <CtaBand />
  </MkShell>);
}
