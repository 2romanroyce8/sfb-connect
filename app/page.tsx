import Navbar from "@/components/home/Navbar";
import Hero from "@/components/home/Hero";
import { BusinessLookupProvider } from "@/lib/businessLookupContext";
import AgentSection from "@/components/home/AgentSection";
import TiersSection from "@/components/home/TiersSection";
import FaqSection from "@/components/home/FaqSection";
import Footer from "@/components/home/Footer";

// Tightened 2026-10-09 (Roman): Hero → Agent → Tiers → FAQ → Footer. The
// stats, process, Presence plans, calculator, credits list, demo form and
// final CTA sections were removed from the homepage.
export default function HomePage() {
  return (
    <main>
      <Navbar />
      <BusinessLookupProvider>
        <Hero />
        <AgentSection />
      </BusinessLookupProvider>
      <TiersSection />
      <FaqSection />
      <Footer />
    </main>
  );
}
