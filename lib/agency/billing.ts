import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";

// Agency platform billing (server-only helpers). Money flows: the $49/month platform fee is a normal subscription on SFB Connect's own Stripe account;
// agencies bill THEIR clients through their own Stripe Connect account. Everything is OFF until AGENCY_BILLING_ENABLED=1 is set in the environment.
export const PLATFORM_PRICE_CENTS = 4900;
export const billingEnabled = () => process.env.AGENCY_BILLING_ENABLED === "1";
export const ACTIVE_STATUSES = ["active", "trialing"];

/** Entitlement, enforced server-side: with billing off everyone is entitled (workspaces are free); with it on, only active/trialing subscriptions. */
export async function agencyEntitled(service: SupabaseClient, agencyId: string): Promise<boolean> {
  if (!billingEnabled()) return true;
  const { data } = await service.from("agency_billing").select("subscription_status").eq("agency_id", agencyId).maybeSingle();
  return !!data?.subscription_status && ACTIVE_STATUSES.includes(data.subscription_status as string);
}

const iso = (n: number | null | undefined) => (n ? new Date(n * 1000).toISOString() : null);
/** Writes subscription state for an agency from a verified Stripe subscription object. The agency id comes from the metadata WE set at checkout and is re-checked against the stored customer id. */
export async function syncAgencySubscription(service: SupabaseClient, sub: Stripe.Subscription): Promise<boolean> {
  if (sub.metadata?.kind !== "agency_platform") return false;
  const agencyId = sub.metadata.agency_id; if (!agencyId) return true;
  const customer = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const { data: row } = await service.from("agency_billing").select("stripe_customer_id").eq("agency_id", agencyId).maybeSingle();
  if (row?.stripe_customer_id && row.stripe_customer_id !== customer) { console.error("[agency-billing] customer mismatch for", agencyId); return true; }
  const item = sub.items?.data?.[0] as (Stripe.SubscriptionItem & { current_period_end?: number }) | undefined;
  const periodEnd = (sub as unknown as { current_period_end?: number }).current_period_end ?? item?.current_period_end;
  await service.from("agency_billing").upsert({ agency_id: agencyId, stripe_customer_id: customer, stripe_subscription_id: sub.id, subscription_status: sub.status, current_period_end: iso(periodEnd), cancel_at_period_end: !!sub.cancel_at_period_end, updated_at: new Date().toISOString() });
  return true;
}
