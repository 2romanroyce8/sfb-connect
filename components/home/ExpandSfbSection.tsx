import { createSupabaseServerClient } from "@/lib/supabase/server";
import ExpandSfbSectionClient from "./ExpandSfbSectionClient";

// Server wrapper: the public pricing page and the customer dashboard must
// never have two independent pricing truths, so this reads the exact same
// addon_products/credit_packages tables the owner manages at
// /team/settings/add-ons and the customer buys from at /dashboard/billing.
// RLS's *_public_read policies (active = true) make this safe for an
// anonymous visitor.
export default async function ExpandSfbSection() {
  const supabase = createSupabaseServerClient();
  const [{ data: products }, { data: packages }] = await Promise.all([
    supabase.from("addon_products").select("id, key, name, category, description, best_for, billing_type, unit, base_price_cents, featured").eq("active", true).order("sort_order"),
    supabase.from("credit_packages").select("id, name, credits, price_cents").eq("active", true).order("sort_order"),
  ]);

  return <ExpandSfbSectionClient products={products ?? []} packages={packages ?? []} />;
}
