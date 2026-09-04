import Navbar from "@/components/home/Navbar";
import Hero from "@/components/home/Hero";
import { BusinessLookupProvider } from "@/lib/businessLookupContext";
import ShiftSection from "@/components/home/ShiftSection";
import AlgorithmSection from "@/components/home/AlgorithmSection";
import ProcessSection from "@/components/home/ProcessSection";
import AnalyzeSection from "@/components/home/AnalyzeSection";
import PlatformsSection from "@/components/home/PlatformsSection";
import PricingSection from "@/components/home/PricingSection";
import FaqSection from "@/components/home/FaqSection";
import FinalCta from "@/components/home/FinalCta";
import Footer from "@/components/home/Footer";

export default function HomePage() {
  return (
    <main>
      <Navbar />
      <BusinessLookupProvider>
        <Hero />
        <PlatformsSection />
        <ShiftSection />
        <AnalyzeSection />
        <AlgorithmSection />
        <ProcessSection />
      </BusinessLookupProvider>
      <PricingSection />
      <FaqSection />
      <FinalCta />
      <Footer />
    </main>
  );
}
