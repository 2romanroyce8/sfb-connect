import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { appOrigin } from "@/lib/agent/auth";
import { getStripeClient, StripeNotConfiguredError } from "@/lib/billing/stripe";
import { parseTrialSetup, pendingTrialOrder, startTrialCheckout } from "@/lib/agentProgram/trial";
export const dynamic = "force-dynamic";

// Signed-in users who have an account but no business yet: resume (or start)
// the $1 trial checkout. With no body the latest unpaid order is re-used
// (closed-tab / canceled checkout). With a wizard body a new order is
// created for an account that never had one. Never provisions anything.
export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Sign in first.", redirect: "/login?next=/start" }, { status: 401 });
  const service = createSupabaseServiceClient();
  const { data: biz } = await service.from("businesses").select("id").eq("owner_id", user.id).not("plan_key", "is", null).limit(1).maybeSingle();
  if (biz) return NextResponse.json({ redirect: "/dashboard/agent" });

  let stripe;
  try { stripe = getStripeClient(); } catch (e) {
    if (e instanceof StripeNotConfiguredError) return NextResponse.json({ error: "The trial checkout isn't available right now." }, { status: 409 });
    throw e;
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const pending = await pendingTrialOrder(service, user.id);
  let setup = pending?.setup ?? null; let reuseOrderId = pending?.id ?? null;
  if (body.stockProfile || !setup) {
    const parsed = parseTrialSetup({ ...body, name: body.name ?? user.user_metadata?.full_name ?? user.email.split("@")[0] });
    if ("error" in parsed) return NextResponse.json({ error: pending ? parsed.error : "Pick a sample business and three capabilities first.", needsSetup: !pending }, { status: 400 });
    setup = parsed.setup; if (!pending) reuseOrderId = null;
  }
  try {
    const { checkoutUrl, orderId } = await startTrialCheckout(service, stripe, { ownerId: user.id, email: user.email.toLowerCase(), setup: setup!, origin: appOrigin(req), reuseOrderId });
    await service.from("billing_audit_log").insert({ business_id: null, action: reuseOrderId ? "trial_checkout_resumed" : "trial_checkout_started", detail: { order_id: orderId, owner_id: user.id } });
    return NextResponse.json({ ok: true, checkoutUrl });
  } catch (err) {
    console.error("[trial-checkout]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not open the trial checkout. Please try again." }, { status: 500 });
  }
}
