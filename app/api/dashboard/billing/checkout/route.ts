import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { getStripeClient, StripeNotConfiguredError } from "@/lib/billing/stripe";

// Creates a real Stripe Checkout Session for an add-on or credit package.
// The customer's browser sends only an id + quantity -- the actual price
// is ALWAYS resolved server-side from addon_products/credit_packages.
// Nothing is activated here; this only starts a Stripe Checkout flow. The
// webhook (app/api/webhooks/stripe/route.ts) is the only place a purchase
// actually takes effect, once Stripe confirms it really happened.
export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: business } = await supabase.from("businesses").select("id, stripe_customer_id, legal_name").eq("owner_id", user.id).maybeSingle();
  if (!business) return NextResponse.json({ error: "No business found for this account." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const { kind, addonProductId, creditPackageId, quantity } = body as { kind: "addon" | "credits"; addonProductId?: string; creditPackageId?: string; quantity?: number };
  const qty = Math.max(1, Math.min(50, Number(quantity) || 1));

  try {
    const stripe = getStripeClient();
    const service = createSupabaseServiceClient();

    // Every real customer needs a real Stripe Customer object before
    // checkout -- created once, reused on every subsequent purchase.
    let stripeCustomerId = business.stripe_customer_id;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({ email: user.email ?? undefined, name: business.legal_name ?? undefined, metadata: { business_id: business.id } });
      stripeCustomerId = customer.id;
      await service.from("businesses").update({ stripe_customer_id: stripeCustomerId }).eq("id", business.id);
    }

    const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sfbconnect.com";

    if (kind === "credits") {
      if (!creditPackageId) return NextResponse.json({ error: "Missing creditPackageId." }, { status: 400 });
      const { data: pkg } = await supabase.from("credit_packages").select("id, name, price_cents, stripe_price_id, active").eq("id", creditPackageId).single();
      if (!pkg || !pkg.active) return NextResponse.json({ error: "This credit package isn't available." }, { status: 404 });
      if (!pkg.stripe_price_id) return NextResponse.json({ error: "This credit package hasn't been synced to Stripe yet. An owner needs to sync the catalog first." }, { status: 409 });

      const { data: purchase, error: purchaseError } = await service
        .from("addon_purchases")
        .insert({ business_id: business.id, credit_package_id: pkg.id, purchase_type: "credit_package", quantity: 1, amount_cents: pkg.price_cents, status: "pending" })
        .select("id")
        .single();
      if (purchaseError || !purchase) throw new Error(purchaseError?.message || "Could not start purchase.");

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer: stripeCustomerId,
        line_items: [{ price: pkg.stripe_price_id, quantity: 1 }],
        success_url: `${siteUrl}/dashboard/billing?purchase=success`,
        cancel_url: `${siteUrl}/dashboard/billing?purchase=canceled`,
        metadata: { business_id: business.id, purchase_id: purchase.id },
      });
      await service.from("addon_purchases").update({ stripe_checkout_session_id: session.id }).eq("id", purchase.id);
      return NextResponse.json({ checkoutUrl: session.url });
    }

    if (kind === "addon") {
      if (!addonProductId) return NextResponse.json({ error: "Missing addonProductId." }, { status: 400 });
      const { data: product } = await supabase.from("addon_products").select("id, name, billing_type, base_price_cents, stripe_price_id, active").eq("id", addonProductId).single();
      if (!product || !product.active) return NextResponse.json({ error: "This add-on isn't available." }, { status: 404 });
      if (!product.stripe_price_id) return NextResponse.json({ error: "This add-on hasn't been synced to Stripe yet. An owner needs to sync the catalog first." }, { status: 409 });

      const isRecurring = product.billing_type === "recurring";
      const { data: purchase, error: purchaseError } = await service
        .from("addon_purchases")
        .insert({
          business_id: business.id,
          addon_product_id: product.id,
          purchase_type: isRecurring ? "addon_recurring" : "addon_one_time",
          quantity: qty,
          amount_cents: product.base_price_cents * qty,
          status: "pending",
        })
        .select("id")
        .single();
      if (purchaseError || !purchase) throw new Error(purchaseError?.message || "Could not start purchase.");

      const session = await stripe.checkout.sessions.create({
        mode: isRecurring ? "subscription" : "payment",
        customer: stripeCustomerId,
        line_items: [{ price: product.stripe_price_id, quantity: qty }],
        success_url: `${siteUrl}/dashboard/billing?purchase=success`,
        cancel_url: `${siteUrl}/dashboard/billing?purchase=canceled`,
        metadata: { business_id: business.id, purchase_id: purchase.id },
        subscription_data: isRecurring ? { metadata: { business_id: business.id, addon_product_id: product.id, purchase_id: purchase.id } } : undefined,
      });
      await service.from("addon_purchases").update({ stripe_checkout_session_id: session.id }).eq("id", purchase.id);
      return NextResponse.json({ checkoutUrl: session.url });
    }

    return NextResponse.json({ error: "Invalid purchase kind." }, { status: 400 });
  } catch (err) {
    if (err instanceof StripeNotConfiguredError) return NextResponse.json({ error: "stripe_not_configured", message: err.message }, { status: 409 });
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not start checkout." }, { status: 500 });
  }
}
