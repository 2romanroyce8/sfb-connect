import Navbar from "@/components/home/Navbar";
import Hero from "@/components/home/Hero";
import { BusinessLookupProvider } from "@/lib/businessLookupContext";
import ShiftSection from "@/components/home/ShiftSection";
import TechnologySection from "@/components/home/TechnologySection";
import ServiceArchitectureSection from "@/components/home/ServiceArchitectureSection";
import AlgorithmSection from "@/components/home/AlgorithmSection";
import ProcessSection from "@/components/home/ProcessSection";
import AnalyzeSection from "@/components/home/AnalyzeSection";
import PlatformsSection from "@/components/home/PlatformsSection";
import PortfolioPreviewSection from "@/components/home/PortfolioPreviewSection";
import MoreThanPresenceSection from "@/components/home/MoreThanPresenceSection";
import PricingSection from "@/components/home/PricingSection";
import FaqSection from "@/components/home/FaqSection";
import FinalCta from "@/components/home/FinalCta";
import Footer from "@/components/home/Footer";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = createSupabaseServerClient();
  const { data: featuredProjects } = await supabase
    .from("portfolio_projects")
    .select("slug, business_name, industry, project_type, cover_image_url")
    .eq("published", true)
    .eq("featured", true)
    .order("sort_order", { ascending: true })
    .limit(3);

  return (
    <main>
      <Navbar />
      <BusinessLookupProvider>
        <Hero />
        <PlatformsSection />
        <ShiftSection />
        <TechnologySection />
        <ServiceArchitectureSection />
        <AlgorithmSection />
        <AnalyzeSection />
        <ProcessSection />
      </BusinessLookupProvider>
      <PortfolioPreviewSection projects={featuredProjects ?? []} />
      <MoreThanPresenceSection />
      <PricingSection />
      <FaqSection />
      <FinalCta />
      <Footer />
    </main>
  );
}
