import type { Metadata } from "next";
import Navbar from "@/components/home/Navbar";
import Footer from "@/components/home/Footer";
import HowItWorks from "@/components/pricing/HowItWorks";
import PricingTiers from "@/components/pricing/PricingTiers";
import RoiCalculator from "@/components/pricing/RoiCalculator";
import CreditPriceList from "@/components/pricing/CreditPriceList";
import VendorGrid from "@/components/pricing/VendorGrid";
import PricingFaq from "@/components/pricing/PricingFaq";
import { TIERS, fmtUsd } from "@/lib/agentProgram/config";

export const revalidate = 300;

const solo = TIERS.find((t) => t.key === "solo")!;
export const metadata: Metadata = {
  title: "Pricing — SFB Agent | One build. One monthly. That's it.",
  description: `Free trial on a sample business. Live on yours from ${fmtUsd(solo.monthlyUsd)}/month plus a one-time setup. Every credit price published; cancel anytime.`,
  alternates: { canonical: "/pricing" },
  openGraph: { title: "SFB Agent pricing", description: "One build. One monthly. That's it.", url: "/pricing" },
};

/**
 * /pricing — the overhaul (Roman spec 2026-10-10). Sections in order:
 * how it works → glass tier cards (monthly|annual) with the offer → ROI
 * calculator (directly below the cards — primary conversion driver) →
 * credit price list as a visible expandable → six vendors vs one agent → FAQ.
 * Every figure comes from lib/agentProgram/config.ts.
 */
export default function PricingPage({ searchParams }: { searchParams?: { checkout?: string } }) {
  const canceled = searchParams?.checkout === "canceled";
  return (
    <main className="bg-black text-white">
      <Navbar />
      {canceled && (
        <div className="fixed top-[84px] left-1/2 -translate-x-1/2 z-40 rounded-full px-5 h-[40px] inline-flex items-center text-[13px] text-white" style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.14)" }}>Checkout canceled — nothing was charged.</div>
      )}
      <HowItWorks />
      <PricingTiers />
      <RoiCalculator />
      <CreditPriceList />
      <VendorGrid />
      <PricingFaq />
      <Footer />
    </main>
  );
}
