import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getEntitlements } from "@/lib/billing/entitlements";
import { SFB_PLAN_LABELS, SFB_PLAN_PRICES, isPlanKey } from "@/lib/team/plans";
import BillingDashboard from "@/components/dashboard/BillingDashboard";

// middleware.ts already gates all of /dashboard/** for any authenticated
// user and redirects unauthenticated visitors to the existing /login page.
// The checks below only need to cover the "logged in, but not actually a
// provisioned customer" case (e.g. a Sales OS rep account with no business).
export default async function BillingPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/billing");

  const { data: business } = await supabase.from("businesses").select("id, legal_name, plan_key, stripe_customer_id").eq("owner_id", user.id).maybeSingle();
  if (!business) redirect("/login?next=/dashboard/billing");

  const [entitlements, { data: activeAddons }, { data: purchases }, { data: allProducts }, { data: creditPackages }, { data: opportunities }] = await Promise.all([
    getEntitlements(supabase, business.id),
    supabase.from("customer_addons").select("id, quantity, status, current_period_end, stripe_subscription_id, addon_products(key, name, base_price_cents, unit)").eq("business_id", business.id).eq("status", "active"),
    supabase.from("addon_purchases").select("id, purchase_type, quantity, amount_cents, status, created_at, addon_products(name), credit_packages(name)").eq("business_id", business.id).order("created_at", { ascending: false }).limit(20),
    supabase.from("addon_products").select("id, key, name, category, description, best_for, billing_type, unit, base_price_cents, featured, sort_order").eq("active", true).order("sort_order"),
    supabase.from("credit_packages").select("id, name, credits, price_cents").eq("active", true).order("sort_order"),
    supabase.from("expansion_opportunities").select("id, type, evidence, status, addon_products(id, name, base_price_cents)").eq("business_id", business.id).eq("status", "OPEN").order("detected_at", { ascending: false }),
  ]);

  const planKey = isPlanKey(business.plan_key) ? business.plan_key : null;
  const planPrice = planKey ? SFB_PLAN_PRICES[planKey] : null;
  const planLabel = planKey ? SFB_PLAN_LABELS[planKey] : "No active plan";

  // Estimated recurring total: base plan + every active recurring add-on's
  // (price x quantity). Purely a real-data sum, never a made-up number.
  const recurringAddonTotalCents = (activeAddons ?? []).reduce((sum, a) => {
    const product = a.addon_products as unknown as { base_price_cents: number } | null;
    return sum + (product ? product.base_price_cents * a.quantity : 0);
  }, 0);
  const estimatedMonthlyTotalCents = Math.round((planPrice ?? 0) * 100) + recurringAddonTotalCents;

  return (
    <BillingDashboard
      businessName={business.legal_name}
      planLabel={planLabel}
      planPriceCents={planPrice ? Math.round(planPrice * 100) : null}
      estimatedMonthlyTotalCents={estimatedMonthlyTotalCents}
      entitlements={entitlements}
      activeAddons={(activeAddons ?? []) as any}
      purchases={(purchases ?? []) as any}
      allProducts={(allProducts ?? []) as any}
      creditPackages={(creditPackages ?? []) as any}
      opportunities={(opportunities ?? []) as any}
    />
  );
}
