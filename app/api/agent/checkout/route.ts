import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getStripeClient, StripeNotConfiguredError } from "@/lib/billing/stripe";
import { ensureAgentPrices } from "@/lib/agentProgram/stripe";
import { agentPlan } from "@/lib/agentProgram/config";
import { rateLimit } from "@/lib/agent/store";
import { appOrigin } from "@/lib/agent/auth";
export const dynamic = "force-dynamic";

// Public: starts a Stripe Checkout for an SFB Agent tier -- monthly
// subscription plus the one-time onboarding fee on the same session. The
// browser sends only a plan key, email and business name; every amount is
// resolved server-side from config. Nothing is provisioned here; the
// webhook does that once Stripe confirms payment.
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await rateLimit(`agent-checkout:${ip}:1h`, 15, 3600);
  if (!rl.allowed) return NextResponse.json({ error: "Too many checkout attempts. Try again in a bit." }, { status: 429 });

  const body = (await req.json().catch(() => ({}))) as { plan?: string; email?: string; businessName?: string };
  const plan = body.plan ? agentPlan(body.plan) : null;
  const email = (body.email ?? "").trim().toLowerCase();
  const businessName = (body.businessName ?? "").trim().slice(0, 120);
  if (!plan) return NextResponse.json({ error: "Choose a plan." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  if (businessName.length < 2) return NextResponse.json({ error: "Enter your business name." }, { status: 400 });

  try {
    const stripe = getStripeClient();
    const service = createSupabaseServiceClient();
    const { monthlyPriceId, onboardingPriceId } = await ensureAgentPrices(stripe, plan);

    const { data: order, error: orderErr } = await service.from("agent_plan_orders").insert({ plan_key: plan.key, email, business_name: businessName, amount_total_cents: (plan.monthlyUsd + plan.onboardingUsd) * 100 }).select("id").single();
    if (orderErr || !order) throw new Error(orderErr?.message || "Could not start the order.");

    const origin = appOrigin(req);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email,
      line_items: [
        { price: monthlyPriceId, quantity: 1 },
        { price: onboardingPriceId, quantity: 1 },
      ],
      success_url: `${origin}/agent/welcome?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/agent?checkout=canceled#pricing`,
      metadata: { kind: "agent_plan", plan_key: plan.key, order_id: order.id, business_name: businessName },
      subscription_data: { metadata: { kind: "agent_plan", plan_key: plan.key, order_id: order.id } },
      billing_address_collection: "auto",
    });
    await service.from("agent_plan_orders").update({ stripe_checkout_session_id: session.id }).eq("id", order.id);
    return NextResponse.json({ checkoutUrl: session.url });
  } catch (err) {
    if (err instanceof StripeNotConfiguredError) return NextResponse.json({ error: "Checkout isn't available right now. Book a demo and we'll set you up directly." }, { status: 409 });
    console.error("[agent-checkout]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not start checkout. Please try again or book a demo." }, { status: 500 });
  }
}
