import type { Metadata } from "next";
import Navbar from "@/components/home/Navbar";
import Footer from "@/components/home/Footer";
import TrialWizard from "@/components/agent/TrialWizard";
export const metadata: Metadata = { title: "Start your SFB Agent trial", description: "128 credits of agent work on a sample business. No card, no integrations, zero setup." };
export default function StartPage() {
  return (
    <main className="bg-black text-white min-h-screen">
      <Navbar />
      <section className="pt-[140px] pb-24 px-6"><div className="max-w-[720px] mx-auto"><TrialWizard /></div></section>
      <Footer />
    </main>
  );
}
