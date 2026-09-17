import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStripeClient, StripeNotConfiguredError } from "@/lib/billing/stripe";

// Cancels a recurring add-on at the end of the current billing period --
// never immediately, so already-paid access isn't yanked early. The
// customer_addons row itself only flips to "canceled" once Stripe's
// customer.subscription.deleted webhook actually fires at period end (see
// the webhook handler) -- this route just sets the intent.
export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: business } = await supabase.from("businesses").select("id").eq("owner_id", user.id).maybeSingle();
  if (!business) return NextResponse.json({ error: "No business found for this account." }, { status: 404 });

  const { customerAddonId } = (await req.json()) as { customerAddonId: string };
  const { data: addon } = await supabase.from("customer_addons").select("id, business_id, stripe_subscription_id, status").eq("id", customerAddonId).single();
  if (!addon || addon.business_id !== business.id) return NextResponse.json({ error: "Add-on not found." }, { status: 404 });
  if (!addon.stripe_subscription_id) return NextResponse.json({ error: "This add-on has no active subscription to cancel." }, { status: 400 });

  try {
    const stripe = getStripeClient();
    await stripe.subscriptions.update(addon.stripe_subscription_id, { cancel_at_period_end: true });
    await supabase.from("customer_addons").update({ status: "canceled_at_period_end", updated_at: new Date().toISOString() }).eq("id", customerAddonId);
    await supabase.from("billing_audit_log").insert({ business_id: business.id, action: "addon_cancel_requested", actor_id: user.id, detail: { customer_addon_id: customerAddonId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof StripeNotConfiguredError) return NextResponse.json({ error: "stripe_not_configured", message: err.message }, { status: 409 });
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not cancel." }, { status: 500 });
  }
}
