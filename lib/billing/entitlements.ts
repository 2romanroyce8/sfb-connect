// Central entitlement engine. Every feature-gate decision in the codebase
// (customer dashboard, future Sales OS support views) MUST call through
// here rather than sprinkling `if (plan === "revenue_dominance")` checks
// across components -- that duplication is exactly what makes an
// entitlement system impossible to reason about or change safely later.
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCreditBalance } from "./credits";

// Base allowances per plan -- included before any add-on purchase. These
// numbers are a starting policy, kept in one place so they can be revised
// without hunting through UI code.
const BASE_ALLOWANCES: Record<string, { locations: number; markets: number; competitors: number; queries: number }> = {
  revenue_presence: { locations: 1, markets: 1, competitors: 2, queries: 10 },
  revenue_growth: { locations: 1, markets: 2, competitors: 5, queries: 25 },
  revenue_dominance: { locations: 2, markets: 4, competitors: 10, queries: 50 },
};
const DEFAULT_ALLOWANCE = { locations: 1, markets: 1, competitors: 2, queries: 10 };

export type Entitlements = {
  businessId: string;
  planKey: string | null;
  locationAllowance: number;
  marketAllowance: number;
  competitorAllowance: number;
  queryAllowance: number;
  creditBalance: number;
  activeAddonKeys: string[];
};

/** Resolves everything a business is entitled to RIGHT NOW: base plan
 * allowance + every currently-active recurring add-on's quantity + credit
 * balance. Never trusts a cached/denormalized number -- always reads the
 * live customer_addons + credit ledger state. */
export async function getEntitlements(supabase: SupabaseClient, businessId: string): Promise<Entitlements> {
  const [{ data: business }, { data: addons }, creditBalance] = await Promise.all([
    supabase.from("businesses").select("plan_key").eq("id", businessId).single(),
    supabase
      .from("customer_addons")
      .select("quantity, addon_products(key, unit)")
      .eq("business_id", businessId)
      .eq("status", "active"),
    getCreditBalance(supabase, businessId),
  ]);

  const planKey = business?.plan_key ?? null;
  const base = (planKey && BASE_ALLOWANCES[planKey]) || DEFAULT_ALLOWANCE;

  let locationAllowance = base.locations;
  let marketAllowance = base.markets;
  let competitorAllowance = base.competitors;
  let queryAllowance = base.queries;
  const activeAddonKeys: string[] = [];

  for (const addon of addons ?? []) {
    const product = addon.addon_products as unknown as { key: string; unit: string } | null;
    if (!product) continue;
    activeAddonKeys.push(product.key);
    if (product.unit === "per_location") locationAllowance += addon.quantity;
    if (product.unit === "per_market") marketAllowance += addon.quantity;
    if (product.unit === "per_competitor") competitorAllowance += addon.quantity;
    if (product.key === "ai_visibility_expansion") queryAllowance += addon.quantity * 25; // one "pack" = +25 queries
    if (product.key === "competitor_intelligence_pack") competitorAllowance += addon.quantity * 7; // "5-10 selected competitors"
  }

  return { businessId, planKey, locationAllowance, marketAllowance, competitorAllowance, queryAllowance, creditBalance, activeAddonKeys };
}

export type Feature = "additional_location" | "additional_market" | "additional_competitor" | "action_credits";

/** A single yes/no gate, given already-resolved entitlements and how much
 * of that resource is CURRENTLY in use. Kept separate from getEntitlements
 * so callers that already loaded entitlements once don't re-query. */
export function canUseFeature(entitlements: Entitlements, feature: Feature, currentUsage: number): boolean {
  switch (feature) {
    case "additional_location":
      return currentUsage < entitlements.locationAllowance;
    case "additional_market":
      return currentUsage < entitlements.marketAllowance;
    case "additional_competitor":
      return currentUsage < entitlements.competitorAllowance;
    case "action_credits":
      return entitlements.creditBalance > 0;
    default:
      return false;
  }
}
