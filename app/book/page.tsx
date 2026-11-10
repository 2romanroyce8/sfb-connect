import type { Metadata } from "next";
import MkShell from "@/components/mk/MkShell";
import { PageHero } from "@/components/mk/MkParts";
import { SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Book a walkthrough",
  description: "Request a walkthrough of SFB Connect.",
  alternates: { canonical: "/book" },
};

export default function BookPage() {
  const subject = encodeURIComponent("SFB Connect walkthrough request");
  const body = encodeURIComponent("Hi SFB Connect,\n\nI'd like a walkthrough.\n\nName:\nCompany:\nPreferred times and time zone:\n");
  return (
    <MkShell>
      <PageHero
        eyebrow="Booking"
        title="Book a walkthrough."
        lead="Tell us when you’re available. We’ll reply by email to confirm a time."
        ctas={[
          { href: `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`, label: "Request a time by email" },
          { href: "/#demo", label: "Try the interactive demo" },
        ]}
      />
    </MkShell>
  );
}
