import type { Metadata } from "next";
import MkShell from "@/components/mk/MkShell";
import { PageHero, Section, CardGrid, Steps, Faq, CtaBand } from "@/components/mk/MkParts";
export const metadata: Metadata = { title: "For sales representatives", description: "Work a pipeline, send personalized demos, and book meetings.", alternates: { canonical: "/sales-reps" } };
export default function Page() {
  return (<MkShell>
    <PageHero eyebrow="Sales representatives" title="A demo to send, a pipeline to work." lead="The sales workspace is being built next. Demos you send are live today; the pipeline, calls and follow-ups are coming." />
    <Section eyebrow="Your day" title="Everything the job needs."><CardGrid items={[
      { tag: "Coming next", title: "Assigned leads", body: "See what is yours and what needs a touch today." },
      { tag: "Coming next", title: "Personalized demos", body: "Send a demo built for that business and see when it is opened." },
      { tag: "Coming next", title: "Follow-ups and reminders", body: "Nothing slips; every follow-up has a date and an owner." },
      { tag: "Coming next", title: "Calls and meetings", body: "Log calls, schedule meetings and keep notes on the record." },
      { tag: "Coming next", title: "Your numbers", body: "Activity, pipeline and results, counted from your real records." },
      { tag: "Coming next", title: "Commission tracking", body: "Set by the agency and visible to the rep." },
    ]} /></Section>
    <CtaBand />
  </MkShell>);
}
