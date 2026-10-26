import type { Metadata } from "next";
import MkShell from "@/components/mk/MkShell";
import { PageHero, Section, CardGrid, Steps, Faq, CtaBand } from "@/components/mk/MkParts";
export const metadata: Metadata = { title: "White-label platform", description: "Your logo, colors and domain on demos and client portals.", alternates: { canonical: "/white-label" } };
export default function Page() {
  return (<MkShell>
    <PageHero eyebrow="White-label" title="It looks like yours because it is." lead="Your logo, colors, contact details and booking link on every demo page and client portal." />
    <Section eyebrow="Branding" title="What you control."><CardGrid items={[
      { title: "Logo and colors", body: "Applied across demo pages and the client portal." },
      { title: "Subdomain and custom domain", body: "A custom domain attaches only after DNS verification, so a domain can't be claimed by the wrong agency." },
      { title: "Email sender", body: "Client communications can come from your own address once configured." },
      { title: "Booking link", body: "Your calendar link in every call to action." },
    ]} cols={2} /></Section>
    <CtaBand />
  </MkShell>);
}
