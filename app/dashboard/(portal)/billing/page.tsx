import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCustomerContext } from "@/lib/customerPortal/context";
import BillingDashboard from "@/components/dashboard/BillingDashboard";

// Authorization is resolved by the ONE centralized getCustomerContext() --
// this page never re-implements "is this a paid customer" itself. The
// (portal) route group's layout has already confirmed customer status once
// for the shell; this call is cheap and gives this page its own typed,
// business-scoped context directly (Next.js Server Components don't share
// data across layout/page boundaries without explicit plumbing).
export default async function BillingPage() {
  const result = await getCustomerContext("/dashboard/billing");
  if (result.status === "no_customer") redirect("/dashboard/no-membership");
  const { context } = result;
  const supabase = createSupabaseServerClient();

  const [{ data: activeAddons }, { data: purchases }, { data: allProducts }, { data: creditPackages }, { data: opportunities }] = await Promise.all([
    supabase.from("customer_addons").select("id, quantity, status, current_period_end, stripe_subscription_id, addon_products(key, name, base_price_cents, unit)").eq("business_id", context.business.id).eq("status", "active"),
    supabase.from("addon_purchases").select("id, purchase_type, quantity, amount_cents, status, created_at, addon_products(name), credit_packages(name)").eq("business_id", context.business.id).order("created_at", { ascending: false }).limit(20),
    supabase.from("addon_products").select("id, key, name, category, description, best_for, billing_type, unit, base_price_cents, featured, sort_order").eq("active", true).order("sort_order"),
    supabase.from("credit_packages").select("id, name, credits, price_cents").eq("active", true).order("sort_order"),
    supabase.from("expansion_opportunities").select("id, type, evidence, status, addon_products(id, name, base_price_cents)").eq("business_id", context.business.id).eq("status", "OPEN").order("detected_at", { ascending: false }),
  ]);

  // Estimated recurring total: base plan + every active recurring add-on's
  // (price x quantity). Purely a real-data sum, never a made-up number.
  const recurringAddonTotalCents = (activeAddons ?? []).reduce((sum, a) => {
    const product = a.addon_products as unknown as { base_price_cents: number } | null;
    return sum + (product ? product.base_price_cents * a.quantity : 0);
  }, 0);
  const estimatedMonthlyTotalCents = (context.planPriceCents ?? 0) + recurringAddonTotalCents;

  return (
    <BillingDashboard
      businessName={context.business.legalName}
      planLabel={context.planLabel}
      planPriceCents={context.planPriceCents}
      estimatedMonthlyTotalCents={estimatedMonthlyTotalCents}
      entitlements={context.entitlements}
      activeAddons={(activeAddons ?? []) as any}
      purchases={(purchases ?? []) as any}
      allProducts={(allProducts ?? []) as any}
      creditPackages={(creditPackages ?? []) as any}
      opportunities={(opportunities ?? []) as any}
    />
  );
}
