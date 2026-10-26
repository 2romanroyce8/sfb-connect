import type { Metadata } from "next";
import MkShell from "@/components/mk/MkShell";
import { PageHero, Section, CardGrid, Steps, Faq, CtaBand } from "@/components/mk/MkParts";
export const metadata: Metadata = { title: "AI demo builder", description: "Create personalized, branded AI demos for a specific business and publish them on a link you can track.", alternates: { canonical: "/demo-builder" } };
export default function Page() {
  return (<MkShell>
    <PageHero eyebrow="AI demo builder" title="Show a business its own AI, before they buy." lead="Enter the business name, website, industry, hours and services. Brand it as yours. Publish a link and see how the prospect engages." />
    <Section eyebrow="Modules" title="What a demo can include.">
      <CardGrid items={[
        { title: "AI voice receptionist", body: "A sandboxed voice conversation about the business's services, hours and booking, with a transcript and session limits." },
        { title: "AI website chatbot", body: "Text conversations from approved business information, with lead qualification and a human-handoff example." },
        { title: "Website audit", body: "Real checks on a public site (HTTPS, titles, headings, schema, mobile viewport, contact info) with the evidence shown." },
        { title: "Missed-call text-back", body: "The full missed call to booked appointment story, shown with simulated events." },
        { title: "ROI calculator", body: "Transparent formulas from the prospect's own numbers, labeled as an estimate." },
        { title: "Follow-up sequence", body: "A visual sequence from new lead to booking. Nothing is sent during a demo." },
      ]} />
    </Section>
    <Section tint eyebrow="Honest by design" title="Simulations are labeled. Live actions are labeled." lead="A demo never presents recorded audio as a live agent, a simulated booking as a real one, or an estimate as a promise." />
    <Section eyebrow="Tracking" title="Know what happened after you sent it." lead="Opens, chat and voice sessions, audit requests, CTA clicks, booking requests and lead submissions. Tracking is consent-aware and disclosed to the visitor." />
    <CtaBand />
  </MkShell>);
}
