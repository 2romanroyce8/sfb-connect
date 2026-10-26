import type { Metadata } from "next";
import MkShell from "@/components/mk/MkShell";
import { PageHero, Section, CardGrid, Steps, Faq, CtaBand } from "@/components/mk/MkParts";
import { SUPPORT_EMAIL } from "@/lib/site";
export const metadata: Metadata = { title: "Contact", description: "Talk to the SFB Connect team.", alternates: { canonical: "/contact" } };
export default function Page() {
  return (<MkShell>
    <PageHero eyebrow="Contact" title="Talk to a person." lead="Questions about the platform, pricing or getting your agency started? Email us and a real person will reply." ctas={[{ href: `mailto:${SUPPORT_EMAIL}`, label: `Email ${SUPPORT_EMAIL}` }, { href: "/signup", label: "Start Your Agency" }]} />
    <CtaBand title="Ready when you are." lead="Create your agency and build your first demo." />
  </MkShell>);
}
