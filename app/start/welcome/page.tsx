import Link from "next/link";
import { redirect } from "next/navigation";
import Navbar from "@/components/home/Navbar";
import Footer from "@/components/home/Footer";
import { getStripeClient, isStripeConfigured } from "@/lib/billing/stripe";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { provisionTrialOrder } from "@/lib/agentProgram/trial";
import { TRIAL_TIER, fmtUsd } from "@/lib/agentProgram/config";
import TrialResume from "@/components/agent/TrialResume";
export const dynamic = "force-dynamic";

// After the $1 checkout. The session is read from STRIPE, server-side — the
// browser only supplies an id, never a status — so a "paid" here is as
// authoritative as the webhook, and provisioning is claim-based so the two
// can never double-provision. A signed-in, provisioned customer goes
// straight to the dashboard.
export default async function TrialWelcomePage({ searchParams }: { searchParams: { session_id?: string } }) {
  let state: "paid" | "setting_up" | "open" | "unknown" = "unknown";
  if (searchParams.session_id && isStripeConfigured()) {
    try {
      const session = await getStripeClient().checkout.sessions.retrieve(searchParams.session_id);
      if (session.metadata?.kind === "agent_trial") {
        const r = await provisionTrialOrder(createSupabaseServiceClient(), session, { via: "success_page" });
        state = r.state === "provisioned" || r.state === "already" ? "paid" : r.state === "claimed" ? "setting_up" : r.state === "not_paid" ? "open" : "unknown";
        if (state === "paid") {
          const { data: { user } } = await createSupabaseServerClient().auth.getUser();
          if (user && session.metadata.owner_id === user.id) redirect("/dashboard/agent?welcome=trial");
        }
      }
    } catch (e) {
      // redirect() throws on purpose; everything else is an honest "unknown".
      if (e && typeof e === "object" && "digest" in e && String((e as { digest?: string }).digest).startsWith("NEXT_REDIRECT")) throw e;
      state = "unknown";
    }
  }
  return (
    <main className="bg-black text-white min-h-screen">
      <Navbar />
      <section className="pt-[160px] pb-24 px-6">
        <div className="max-w-[640px] mx-auto rounded-[18px] p-8 md:p-10" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[#30D158] mb-4">SFB Agent · {TRIAL_TIER.trialDays}-day trial</div>
          {state === "paid" ? (
            <>
              <h1 className="text-[32px] md:text-[40px] font-bold tracking-[-0.03em] leading-[1.05]">Your agent is running.</h1>
              <p className="mt-5 text-[15px] leading-[1.6] text-white/[0.6]">Payment received. Your demo business, {TRIAL_TIER.credits} credits and {TRIAL_TIER.trialDays} days of access are ready. Sign in to watch it work.</p>
              <Link href="/login?next=/dashboard/agent" className="mt-8 inline-flex items-center bg-white text-black px-6 py-3 rounded-full text-[14px] font-semibold hover:opacity-85">Open your dashboard →</Link>
            </>
          ) : state === "setting_up" ? (
            <>
              <meta httpEquiv="refresh" content="3" />
              <h1 className="text-[32px] font-bold tracking-[-0.03em]">Payment received — setting up your agent.</h1>
              <p className="mt-4 text-[15px] text-white/[0.6]">This takes a few seconds. The page refreshes itself.</p>
            </>
          ) : state === "open" ? (
            <>
              <h1 className="text-[32px] font-bold tracking-[-0.03em]">Payment not completed yet.</h1>
              <p className="mt-4 text-[15px] text-white/[0.6]">Stripe hasn&apos;t confirmed the {fmtUsd(TRIAL_TIER.trialUsd)} payment. Your account exists; finish the checkout to start the {TRIAL_TIER.trialDays} days.</p>
              <div className="mt-8"><TrialResume label={`Finish the ${fmtUsd(TRIAL_TIER.trialUsd)} checkout →`} /></div>
            </>
          ) : (
            <>
              <h1 className="text-[32px] font-bold tracking-[-0.03em]">Welcome.</h1>
              <p className="mt-4 text-[15px] text-white/[0.6]">If you just paid for the trial, sign in to open your dashboard. Otherwise, start the trial first.</p>
              <div className="mt-8 flex gap-3 flex-wrap"><Link href="/login?next=/dashboard/agent" className="inline-flex items-center bg-white text-black px-6 py-3 rounded-full text-[14px] font-semibold">Sign in →</Link><Link href="/start" className="inline-flex items-center px-6 py-3 rounded-full text-[14px] font-semibold" style={{ border: "1px solid rgba(255,255,255,0.2)" }}>Start the trial</Link></div>
            </>
          )}
        </div>
      </section>
      <Footer />
    </main>
  );
}
