import Navbar from "@/components/home/Navbar";
import Hero from "@/components/home/Hero";
import { BusinessLookupProvider } from "@/lib/businessLookupContext";
import AlgorithmSection from "@/components/home/AlgorithmSection";
import ProcessSection from "@/components/home/ProcessSection";
import AnalyzeSection from "@/components/home/AnalyzeSection";
import PlatformsSection from "@/components/home/PlatformsSection";
import PricingSection from "@/components/home/PricingSection";
import AgentSection from "@/components/home/AgentSection";
import CreditsSection from "@/components/home/CreditsSection";
import FaqSection from "@/components/home/FaqSection";
import FinalCta from "@/components/home/FinalCta";
import Footer from "@/components/home/Footer";

export default function HomePage() {
  return (
    <main>
      <Navbar />
      <BusinessLookupProvider>
        <Hero />
        <AgentSection />
        <PlatformsSection />
        <AlgorithmSection />
        <AnalyzeSection />
        <ProcessSection />
      </BusinessLookupProvider>
      <PricingSection />
      <CreditsSection />
      <FaqSection />
      <FinalCta />
      <Footer />
    </main>
  );
}
