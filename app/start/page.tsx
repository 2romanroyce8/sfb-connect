import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Navbar from "@/components/home/Navbar";
import Footer from "@/components/home/Footer";
import FunnelFlow from "@/components/funnel/FunnelFlow";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { getSignup, markPricingSeen, stageFor } from "@/lib/funnel/signup";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Get started — SFB Connect", description: "Create your account, verify your email, and watch your agent read your website and build its own profile of your business." };

// The gated funnel. The server computes the stage from real state — session,
// funnel_signups, and whether a business with a plan exists — so pricing
// cannot be reached before verification + build show, and nothing is paid
// twice. A paying customer goes straight to the dashboard.
export default async function StartPage({ searchParams }: { searchParams: { scan?: string; url?: string } }) {
  const { data: { user } } = await createSupabaseServerClient().auth.getUser();
  let stage: ReturnType<typeof stageFor> = "account"; let signup = null as Awaited<ReturnType<typeof getSignup>>;
  if (user) {
    const db = createSupabaseServiceClient();
    const [{ data: biz }, s] = await Promise.all([db.from("businesses").select("id").eq("owner_id", user.id).not("plan_key", "is", null).limit(1).maybeSingle(), getSignup(db, user.id)]);
    signup = s; stage = stageFor(s, !!biz);
    if (stage === "done") redirect("/dashboard/agent");
    if (stage === "pricing") await markPricingSeen(db, user.id);
  }
  const prefill = (searchParams.scan || searchParams.url || "").slice(0, 200) || null;
  return (
    <main className="bg-black text-white min-h-screen">
      <Navbar />
      <section className="pt-[130px] pb-24 px-6"><div className={`mx-auto ${stage === "pricing" ? "max-w-[1180px]" : "max-w-[760px]"}`}>
        <FunnelFlow stage={stage as "account" | "verify" | "build" | "pricing"} email={signup?.email ?? user?.email ?? null} name={signup?.name ?? null} phone={signup?.phone ?? null} website={signup?.website ?? null} prefillSite={prefill} />
      </div></section>
      <Footer />
    </main>
  );
}
