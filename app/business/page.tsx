import type { Metadata } from "next";
import Navbar from "@/components/home/Navbar";
import Hero from "@/components/home/Hero";
import { BusinessLookupProvider } from "@/lib/businessLookupContext";
import ScoreSection from "@/components/home/ScoreSection";
import ShowcaseVideo from "@/components/home/ShowcaseVideo";
import AgentSection from "@/components/home/AgentSection";
import PlatformsSection from "@/components/home/PlatformsSection";
import AnalyzeSection from "@/components/home/AnalyzeSection";
import FaqSection from "@/components/home/FaqSection";
import Footer from "@/components/home/Footer";

// The original SFB Connect homepage (the done-for-you SFB Agent + "check your business" analyzer), unchanged, moved here when "/" became the agency-platform
// homepage (2026-10-26). Nothing was removed: same sections, same components, same analyzer and funnel links.
export const revalidate = 300;
export const metadata: Metadata = {
  title: "SFB Agent: check your business",
  description: "One AI agent, eight jobs, a human overseer. Check how your business shows up to AI search and meet the SFB Agent.",
  alternates: { canonical: "/business" },
};

export default function BusinessPage() {
  return (
    <main>
      <Navbar />
      <BusinessLookupProvider>
        <Hero />
        <ShowcaseVideo />
        <ScoreSection />
        <AgentSection />
        <PlatformsSection />
        <AnalyzeSection />
      </BusinessLookupProvider>
      <FaqSection />
      <Footer />
    </main>
  );
}
