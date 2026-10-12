import Link from "next/link";
import { redirect } from "next/navigation";
import Navbar from "@/components/home/Navbar";
import Footer from "@/components/home/Footer";
import ProvisionPoller from "@/components/onboarding/ProvisionPoller";
import { getStripeClient, isStripeConfigured } from "@/lib/billing/stripe";
import { tier } from "@/lib/agentProgram/config";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { loadOnboarding } from "@/lib/onboarding/state";
export const dynamic = "force-dynamic";

// STEP 0 — Thank-you page (Roman, 2026-10-12). Stripe sends the customer
// here after checkout. Nothing is granted on this page: the webhook
// provisions; this page reads what is real and says so. One CTA. No upsell.
const money = (cents: number | null | undefined) => (cents == null ? null : `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0 })}`);

export default async function AgentWelcomePage({ searchParams }: { searchParams: { session_id?: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const service = createSupabaseServiceClient();

  // What is real for this customer right now.
  const { data: biz } = user ? await service.from("businesses").select("id, legal_name, plan_key, monthly_credit_allotment").eq("owner_id", user.id).not("plan_key", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle() : { data: null };
  const { data: order } = user
    ? await service.from("agent_plan_orders").select("id, plan_key, amount_total_cents, status, paid_at, stripe_checkout_session_id, billing_interval").or(`owner_id.eq.${user.id},business_id.eq.${biz?.id ?? "00000000-0000-0000-0000-000000000000"}`).order("created_at", { ascending: false }).limit(1).maybeSingle()
    : searchParams.session_id ? await service.from("agent_plan_orders").select("id, plan_key, amount_total_cents, status, paid_at, stripe_checkout_session_id, billing_interval").eq("stripe_checkout_session_id", searchParams.session_id).maybeSingle() : { data: null };

  // Receipt: Stripe's hosted invoice for the checkout session (read-only).
  let receiptUrl: string | null = null; let paidCents: number | null = order?.amount_total_cents ?? null; let paymentState: "paid" | "open" | "unknown" = order?.status === "paid" || order?.status === "provisioned" ? "paid" : "unknown";
  const sessionId = searchParams.session_id ?? order?.stripe_checkout_session_id ?? null;
  if (sessionId && isStripeConfigured()) {
    try {
      const stripe = getStripeClient();
      const s = await stripe.checkout.sessions.retrieve(sessionId);
      paymentState = s.payment_status === "paid" ? "paid" : s.payment_status === "unpaid" ? "open" : paymentState;
      paidCents = s.amount_total ?? paidCents;
      const invoiceId = typeof s.invoice === "string" ? s.invoice : s.invoice?.id;
      if (invoiceId) { const inv = await stripe.invoices.retrieve(invoiceId); receiptUrl = inv.hosted_invoice_url ?? null; }
    } catch { /* show what the database knows */ }
  }
  const t = tier(biz?.plan_key ?? order?.plan_key ?? "");
  const provisioned = !!biz;
  if (provisioned) {
    const { state } = await loadOnboarding(service, biz.id);
    if (state.completed || state.dismissed) redirect("/dashboard");
  }

  return (
    <main className="bg-black text-white min-h-screen">
      <Navbar />
      <section className="pt-[150px] pb-24 px-6">
        <div className="max-w-[680px] mx-auto rounded-[18px] p-8 md:p-10" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
          {paymentState === "open" ? (
            <>
              <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[#FF9F0A] mb-4">Payment not completed</div>
              <h1 className="text-[32px] font-bold tracking-[-0.03em]">Stripe hasn&apos;t confirmed this payment.</h1>
              <p className="mt-4 text-[15px] text-white/[0.6]">If you closed checkout early, pick up where you left off.</p>
              <Link href="/start" className="mt-8 inline-flex items-center bg-white text-black px-6 py-3 rounded-full text-[14px] font-semibold">Back to get started →</Link>
            </>
          ) : (
            <>
              <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[#30D158] mb-4">Thank you</div>
              <h1 className="text-[34px] md:text-[42px] font-bold tracking-[-0.03em] leading-[1.05]">Thank you — you&apos;re in.</h1>
              <div className="mt-7 grid sm:grid-cols-3 gap-3">
                <div className="rounded-[12px] p-4" style={{ background: "#0F0F0F", border: "1px solid rgba(255,255,255,0.08)" }}><div className="text-[11px] uppercase tracking-[0.14em] text-white/[0.45]">Plan</div><div className="text-[17px] font-semibold mt-1">{t ? `${t.name}${order?.billing_interval === "year" ? " · annual" : ""}` : "SFB Agent"}</div></div>
                <div className="rounded-[12px] p-4" style={{ background: "#0F0F0F", border: "1px solid rgba(255,255,255,0.08)" }}><div className="text-[11px] uppercase tracking-[0.14em] text-white/[0.45]">Credits</div><div className="text-[17px] font-semibold mt-1">{t ? t.creditsLabel : "—"}</div></div>
                <div className="rounded-[12px] p-4" style={{ background: "#0F0F0F", border: "1px solid rgba(255,255,255,0.08)" }}><div className="text-[11px] uppercase tracking-[0.14em] text-white/[0.45]">Receipt</div><div className="text-[17px] font-semibold mt-1">{money(paidCents) ?? "—"}</div>{receiptUrl ? <a href={receiptUrl} target="_blank" rel="noopener noreferrer" className="text-[12px] underline text-white/[0.7]">View receipt</a> : <div className="text-[12px] text-white/[0.45]">Emailed by Stripe</div>}</div>
              </div>
              <div className="mt-8">
                <div className="text-[17px] font-semibold">15 minutes from now your agent runs its first task.</div>
                <ol className="mt-3 flex flex-col gap-2 text-[14.5px] text-white/[0.75]">
                  <li className="flex gap-3"><span className="text-[#30D158] font-semibold">1</span><span><strong className="text-white">Connect</strong> — Gmail and Google Calendar. Your agent sends from your address and books onto your calendar.</span></li>
                  <li className="flex gap-3"><span className="text-[#30D158] font-semibold">2</span><span><strong className="text-white">Configure</strong> — confirm your profile, pick who you want more of, switch on the capabilities you want.</span></li>
                  <li className="flex gap-3"><span className="text-[#30D158] font-semibold">3</span><span><strong className="text-white">Launch</strong> — your agent drafts the first campaign; you approve; it goes.</span></li>
                </ol>
              </div>
              {provisioned ? (
                <Link href="/dashboard/onboarding" className="mt-9 inline-flex items-center bg-white text-black px-7 py-3.5 rounded-full text-[15px] font-semibold hover:opacity-85">Start onboarding →</Link>
              ) : (
                <div className="mt-9"><ProvisionPoller /></div>
              )}
              {!user && <p className="mt-5 text-[12.5px] text-white/[0.45]">Signed out? <Link href="/login?next=/agent/welcome" className="underline">Sign in</Link> to continue.</p>}
            </>
          )}
        </div>
      </section>
      <Footer />
    </main>
  );
}
