import Link from "next/link";
import Navbar from "@/components/home/Navbar";
import Footer from "@/components/home/Footer";
import { getStripeClient, isStripeConfigured } from "@/lib/billing/stripe";
import { agentPlan } from "@/lib/agentProgram/config";
export const dynamic = "force-dynamic";

// Post-checkout landing. Reads the session from Stripe (server-side,
// read-only) to show an honest status; provisioning itself is done by the
// webhook, so this page never grants anything.
export default async function AgentWelcomePage({ searchParams }: { searchParams: { session_id?: string } }) {
  let state: "paid" | "open" | "unknown" = "unknown";
  let email = "";
  let planName = "";
  if (searchParams.session_id && isStripeConfigured()) {
    try {
      const s = await getStripeClient().checkout.sessions.retrieve(searchParams.session_id);
      state = s.payment_status === "paid" ? "paid" : "open";
      email = s.customer_details?.email ?? "";
      planName = agentPlan(s.metadata?.plan_key ?? "")?.name ?? "";
    } catch { state = "unknown"; }
  }
  return (
    <main className="bg-black text-white min-h-screen">
      <Navbar />
      <section className="pt-[160px] pb-24 px-6">
        <div className="max-w-[640px] mx-auto rounded-[18px] p-8 md:p-10" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[#30D158] mb-4">SFB Agent</div>
          {state === "paid" ? (
            <>
              <h1 className="text-[32px] md:text-[40px] font-bold tracking-[-0.03em] leading-[1.05]">Your agent is being assigned.</h1>
              <p className="mt-5 text-[15px] leading-[1.6] text-white/[0.6]">Payment received{planName ? ` for the ${planName} plan` : ""}. Within a few minutes you&apos;ll get an email{email ? <> at <span className="text-white">{email}</span></> : null} with a link to set your password and open your SFB dashboard — your agent, its modules, your credits and your human overseer all live there.</p>
              <p className="mt-4 text-[13px] text-white/[0.45]">Didn&apos;t get it within 10 minutes? Check spam, then <Link href="/#book-a-demo" className="underline underline-offset-2 text-white/[0.8]">contact us</Link> and we&apos;ll sort it out.</p>
              <Link href="/login" className="mt-8 inline-flex items-center bg-white text-black px-6 py-3 rounded-full text-[14px] font-semibold hover:opacity-85">Go to sign in →</Link>
            </>
          ) : state === "open" ? (
            <>
              <h1 className="text-[32px] font-bold tracking-[-0.03em]">Payment not completed yet.</h1>
              <p className="mt-4 text-[15px] text-white/[0.6]">Stripe hasn&apos;t confirmed this payment. If you closed checkout early, start again from the pricing section.</p>
              <Link href="/agent#pricing" className="mt-8 inline-flex items-center bg-white text-black px-6 py-3 rounded-full text-[14px] font-semibold">Back to pricing →</Link>
            </>
          ) : (
            <>
              <h1 className="text-[32px] font-bold tracking-[-0.03em]">Welcome.</h1>
              <p className="mt-4 text-[15px] text-white/[0.6]">If you just completed checkout, watch your inbox for your sign-in email. Otherwise, choose a plan to get your agent.</p>
              <Link href="/agent#pricing" className="mt-8 inline-flex items-center bg-white text-black px-6 py-3 rounded-full text-[14px] font-semibold">See plans →</Link>
            </>
          )}
        </div>
      </section>
      <Footer />
    </main>
  );
}
