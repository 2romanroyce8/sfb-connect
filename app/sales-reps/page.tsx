import type { Metadata } from "next";
import MkShell from "@/components/mk/MkShell";
import { PageHero, Section, CardGrid, Steps, Faq, CtaBand } from "@/components/mk/MkParts";
export const metadata: Metadata = { title: "For sales representatives", description: "Work a pipeline, send personalized demos, and book meetings.", alternates: { canonical: "/sales-reps" } };
export default function Page() {
  return (<MkShell>
    <PageHero eyebrow="Sales representatives" title="A demo to send, a pipeline to work." lead="Spend your day on conversations. Leads, demos, follow-ups, calls and meetings live in one place." />
    <Section eyebrow="Your day" title="Everything the job needs."><CardGrid items={[
      { title: "Assigned leads", body: "See what is yours and what needs a touch today." },
      { title: "Personalized demos", body: "Send a demo built for that business and see when it is opened." },
      { title: "Follow-ups and reminders", body: "Nothing slips; every follow-up has a date and an owner." },
      { title: "Calls and meetings", body: "Log calls, schedule meetings and keep notes on the record." },
      { title: "Your numbers", body: "Activity, pipeline and results, counted from your real records." },
      { title: "Commission tracking", body: "Set by the agency and visible to the rep." },
    ]} /></Section>
    <CtaBand />
  </MkShell>);
}
