import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Navbar from "@/components/home/Navbar";
import Footer from "@/components/home/Footer";
import DemoStart from "@/components/demo/DemoStart";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { TRIAL_TIER } from "@/lib/agentProgram/config";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `Hire your SFB Agent — free for ${TRIAL_TIER.trialDays} days`, description: `Paste your website. Your agent reads it, learns how you write, finds your dream clients and drafts outreach in your voice. Free for ${TRIAL_TIER.trialDays} days, no card. Nothing sends without your approval.` };

// Phase 2 slice (a): the hire flow (URL + work email → build show → review →
// email code → dashboard). A signed-in customer goes straight to the dashboard.
export default async function StartPage() {
  const { data: { user } } = await createSupabaseServerClient().auth.getUser();
  if (user) {
    const { data: biz } = await createSupabaseServiceClient().from("businesses").select("id, email_verified_at, plan_key").eq("owner_id", user.id).not("plan_key", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (biz && (biz.email_verified_at || biz.plan_key !== "trial")) redirect("/dashboard/agent");
  }
  return (
    <main className="bg-black text-white min-h-screen">
      <Navbar />
      <section className="pt-[140px] pb-24 px-6"><div className="max-w-[760px] mx-auto"><DemoStart signedInEmail={user?.email ?? null} /></div></section>
      <Footer />
    </main>
  );
}
