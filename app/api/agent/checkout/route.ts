import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { getSignup, stageFor } from "@/lib/funnel/signup";
import { getStripeClient, StripeNotConfiguredError } from "@/lib/billing/stripe";
import { ensureTierPrices } from "@/lib/agentProgram/stripe";
import { tier, annualUsd, type BillingInterval } from "@/lib/agentProgram/config";
import { rateLimit } from "@/lib/agent/store";
import { appOrigin } from "@/lib/agent/auth";
export const dynamic = "force-dynamic";

// Gated (2026-10-12): starts a Stripe Checkout for an SFB Agent tier — monthly
// subscription (monthly, or annual = 10× monthly) plus the one-time onboarding
// fee on the same session — ONLY for a signed-in visitor whose funnel signup
// is verified and has a confirmed profile. Pricing is never reachable before
// that. Every amount is resolved server-side from config. Nothing is
// provisioned here; the webhook does that once Stripe confirms payment.
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await rateLimit(`agent-checkout:${ip}:1h`, 15, 3600);
  if (!rl.allowed) return NextResponse.json({ error: "Too many checkout attempts. Try again in a bit." }, { status: 429 });

  const body = (await req.json().catch(() => ({}))) as { plan?: string; interval?: string };
  const plan = body.plan ? tier(body.plan) : null;
  const interval: BillingInterval = body.interval === "year" ? "year" : "month";
  if (!plan) return NextResponse.json({ error: "Choose a plan." }, { status: 400 });
  const { data: { user } } = await createSupabaseServerClient().auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Create your account first.", startUrl: "/start" }, { status: 401 });
  const service = createSupabaseServiceClient();
  const [{ data: existingBiz }, signup] = await Promise.all([service.from("businesses").select("id").eq("owner_id", user.id).not("plan_key", "is", null).limit(1).maybeSingle(), getSignup(service, user.id)]);
  const stage = stageFor(signup, !!existingBiz);
  if (stage === "done") return NextResponse.json({ error: "You already have an active plan.", redirect: "/dashboard/agent" }, { status: 409 });
  if (stage !== "pricing" || !signup?.profile) return NextResponse.json({ error: "Finish the steps before this one first.", startUrl: "/start" }, { status: 403 });
  const email = signup.email; const businessName = signup.profile.businessName;

  try {
    const stripe = getStripeClient();
    const { recurringPriceId, onboardingPriceId } = await ensureTierPrices(stripe, plan, interval);
    const recurringUsd = interval === "year" ? annualUsd(plan.monthlyUsd) : plan.monthlyUsd;

    const { data: order, error: orderErr } = await service.from("agent_plan_orders").insert({ plan_key: plan.key, email, business_name: businessName, billing_interval: interval, amount_total_cents: (recurringUsd + plan.onboardingUsd) * 100, signup_id: signup.id }).select("id").single();
    if (orderErr || !order) throw new Error(orderErr?.message || "Could not start the order.");

    const origin = appOrigin(req);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email,
      line_items: [
        { price: recurringPriceId, quantity: 1 },
        { price: onboardingPriceId, quantity: 1 },
      ],
      success_url: `${origin}/agent/welcome?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/start?checkout=canceled`,
      metadata: { kind: "agent_plan", plan_key: plan.key, order_id: order.id, business_name: businessName, billing_interval: interval },
      subscription_data: { metadata: { kind: "agent_plan", plan_key: plan.key, order_id: order.id, billing_interval: interval } },
      billing_address_collection: "auto",
    });
    await service.from("agent_plan_orders").update({ stripe_checkout_session_id: session.id }).eq("id", order.id);
    return NextResponse.json({ checkoutUrl: session.url });
  } catch (err) {
    if (err instanceof StripeNotConfiguredError) return NextResponse.json({ error: "Checkout isn't available right now. Book a demo and we'll set you up directly." }, { status: 409 });
    console.error("[agent-checkout]", err instanceof Error ? err.message : err);
    // Stripe errors carry a type/code that is safe to show (no key material); it turns a blind 500 into a one-look diagnosis.
    const se = err as { type?: string; code?: string; statusCode?: number; rawType?: string };
    const stripeHint = se && (se.type || se.code) ? ` [stripe ${se.type ?? se.rawType ?? ""}${se.code ? ` ${se.code}` : ""}${se.statusCode ? ` ${se.statusCode}` : ""}]` : "";
    return NextResponse.json({ error: `Could not start checkout. Please try again or book a demo.${stripeHint}` }, { status: 500 });
  }
}
