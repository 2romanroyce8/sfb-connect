import Navbar from "@/components/home/Navbar";
import Hero from "@/components/home/Hero";
import ShiftSection from "@/components/home/ShiftSection";
import ShortlistSection from "@/components/home/ShortlistSection";
import AlgorithmSection from "@/components/home/AlgorithmSection";
import MissionSection from "@/components/home/MissionSection";
import MythSection from "@/components/home/MythSection";
import ScoreSection from "@/components/home/ScoreSection";
import ProcessSection from "@/components/home/ProcessSection";
import AnalyzeSection from "@/components/home/AnalyzeSection";
import PlatformsSection from "@/components/home/PlatformsSection";
import PosterSection from "@/components/home/PosterSection";
import PricingSection from "@/components/home/PricingSection";
import FaqSection from "@/components/home/FaqSection";
import FinalCta from "@/components/home/FinalCta";
import Footer from "@/components/home/Footer";

export default function HomePage() {
  return (
    <main>
      <Navbar />
      <Hero />
      <ShiftSection />
      <ShortlistSection />
      <AlgorithmSection />
      <MissionSection />
      <MythSection />
      <ScoreSection />
      <ProcessSection />
      <AnalyzeSection />
      <PlatformsSection />
      <PosterSection />
      <PricingSection />
      <FaqSection />
      <FinalCta />
      <Footer />
    </main>
  );
}
