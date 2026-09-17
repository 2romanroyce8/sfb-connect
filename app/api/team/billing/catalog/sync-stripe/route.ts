import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStripeClient, StripeNotConfiguredError } from "@/lib/billing/stripe";

// Owner clicks "Sync to Stripe" on a catalog row -> this creates (or
// updates the price on) a REAL Stripe Product + Price and stores the
// returned ids. This is the one-time bridge between "we have a catalog
// row" and "customers can actually check out for it" -- checkout can't
// run against a row with no stripe_price_id (see the checkout route).
export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: caller } = await supabase.from("users").select("team_role").eq("id", user.id).single();
  if (caller?.team_role !== "owner") return NextResponse.json({ error: "Owner access required." }, { status: 403 });

  const { table, id } = (await req.json()) as { table: "addon_products" | "credit_packages"; id: string };
  if (!["addon_products", "credit_packages"].includes(table) || !id) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  try {
    const stripe = getStripeClient();

    if (table === "addon_products") {
      const { data: product } = await supabase.from("addon_products").select("*").eq("id", id).single();
      if (!product) return NextResponse.json({ error: "Not found." }, { status: 404 });

      const stripeProductId = product.stripe_product_id || (await stripe.products.create({ name: product.name, metadata: { addon_key: product.key } })).id;
      const price = await stripe.prices.create({
        product: stripeProductId,
        currency: "usd",
        unit_amount: product.base_price_cents,
        recurring: product.billing_type === "recurring" ? { interval: "month" } : undefined,
      });

      await supabase.from("addon_products").update({ stripe_product_id: stripeProductId, stripe_price_id: price.id, updated_at: new Date().toISOString() }).eq("id", id);
      await supabase.from("billing_audit_log").insert({ action: "stripe_sync", actor_id: user.id, detail: { table, id, stripe_product_id: stripeProductId, stripe_price_id: price.id } });
      return NextResponse.json({ ok: true, stripeProductId, stripePriceId: price.id });
    }

    const { data: pkg } = await supabase.from("credit_packages").select("*").eq("id", id).single();
    if (!pkg) return NextResponse.json({ error: "Not found." }, { status: 404 });

    const stripeProductId = pkg.stripe_product_id || (await stripe.products.create({ name: pkg.name, metadata: { credit_package_id: pkg.id } })).id;
    const price = await stripe.prices.create({ product: stripeProductId, currency: "usd", unit_amount: pkg.price_cents });

    await supabase.from("credit_packages").update({ stripe_product_id: stripeProductId, stripe_price_id: price.id, updated_at: new Date().toISOString() }).eq("id", id);
    await supabase.from("billing_audit_log").insert({ action: "stripe_sync", actor_id: user.id, detail: { table, id, stripe_product_id: stripeProductId, stripe_price_id: price.id } });
    return NextResponse.json({ ok: true, stripeProductId, stripePriceId: price.id });
  } catch (err) {
    if (err instanceof StripeNotConfiguredError) return NextResponse.json({ error: "stripe_not_configured", message: err.message }, { status: 409 });
    return NextResponse.json({ error: err instanceof Error ? err.message : "Sync failed." }, { status: 500 });
  }
}
