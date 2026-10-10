import Navbar from "@/components/home/Navbar";
import Hero from "@/components/home/Hero";
import { BusinessLookupProvider } from "@/lib/businessLookupContext";
import AgentSection from "@/components/home/AgentSection";
import PlatformsSection from "@/components/home/PlatformsSection";
import AnalyzeSection from "@/components/home/AnalyzeSection";
import TiersSection from "@/components/home/TiersSection";
import FaqSection from "@/components/home/FaqSection";
import Footer from "@/components/home/Footer";

// 2026-10-09 (Roman): the stats, process, Presence plans, calculator, credits
// list, demo form and final CTA sections were removed. Platforms (AI logos)
// and What We Analyze stay — they were never asked to go.
export default function HomePage() {
  return (
    <main>
      <Navbar />
      <BusinessLookupProvider>
        <Hero />
        <AgentSection />
        <PlatformsSection />
        <AnalyzeSection />
      </BusinessLookupProvider>
      <TiersSection />
      <FaqSection />
      <Footer />
    </main>
  );
}
