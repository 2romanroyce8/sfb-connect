import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Navbar from "@/components/home/Navbar";
import Footer from "@/components/home/Footer";
import TrialWizard from "@/components/agent/TrialWizard";
import TrialResume from "@/components/agent/TrialResume";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { pendingTrialOrder } from "@/lib/agentProgram/trial";
import { TRIAL_TIER, TRIAL_IS_FREE, fmtUsd } from "@/lib/agentProgram/config";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `Start your free ${TRIAL_TIER.trialDays}-day SFB Agent trial`, description: `${TRIAL_TIER.credits} credits of agent work. Free, no card, ${TRIAL_TIER.trialDays} days.` };

export default async function StartPage({ searchParams }: { searchParams: { checkout?: string } }) {
  // Signed-in visitors: a customer goes to the dashboard; an account with an
  // unpaid trial order gets a one-click resume above the wizard.
  const { data: { user } } = await createSupabaseServerClient().auth.getUser();
  let pending = false;
  if (user) {
    const service = createSupabaseServiceClient();
    const { data: biz } = await service.from("businesses").select("id").eq("owner_id", user.id).not("plan_key", "is", null).limit(1).maybeSingle();
    if (biz) redirect("/dashboard/agent");
    pending = !TRIAL_IS_FREE && !!(await pendingTrialOrder(service, user.id));
  }
  return (
    <main className="bg-black text-white min-h-screen">
      <Navbar />
      <section className="pt-[140px] pb-24 px-6"><div className="max-w-[720px] mx-auto flex flex-col gap-5">
        {searchParams.checkout === "canceled" && <div className="rounded-[12px] px-4 py-3 text-[13px] text-white/[0.75]" style={{ background: "#111", border: "1px solid rgba(255,255,255,0.12)" }}>Checkout was closed before paying. Nothing was charged{user ? " — your account is saved; finish below when you're ready." : "."}</div>}
        {user && pending && (
          <div className="rounded-[18px] p-6 flex flex-col gap-3" style={{ background: "#0A0A0A", border: "1px solid rgba(48,209,88,0.35)" }}>
            <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[#30D158]">You&apos;re almost there</div>
            <div className="text-[15px] text-white/[0.8]">Signed in as {user.email}. Your trial setup is saved — only the {fmtUsd(TRIAL_TIER.trialUsd)} checkout is left.</div>
            <TrialResume />
          </div>
        )}
        <TrialWizard signedInEmail={user?.email ?? null} />
      </div></section>
      <Footer />
    </main>
  );
}
