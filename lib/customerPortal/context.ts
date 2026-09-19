import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getEntitlements, type Entitlements } from "@/lib/billing/entitlements";
import { SFB_PLAN_LABELS, SFB_PLAN_PRICES, isPlanKey } from "@/lib/team/plans";

export type BusinessLocation = {
  id: string;
  primary_address: string | null;
  cities: string[] | null;
  states: string[] | null;
  service_areas: string[] | null;
  radius_miles: number | null;
};

export type CustomerContext = {
  userId: string;
  email: string | null;
  firstName: string | null;
  business: {
    id: string;
    legalName: string;
    website: string | null;
    primaryCategory: string | null;
  };
  planKey: string | null;
  planLabel: string;
  planPriceCents: number | null;
  entitlements: Entitlements;
  locations: BusinessLocation[];
  selectedLocationId: string | null;
};

export type CustomerAccessResult = { status: "no_customer" } | { status: "ok"; context: CustomerContext };

/**
 * THE single centralized authorization + context resolver for the
 * customer-facing portal (/dashboard/**). Every portal page calls this --
 * never re-implement "is this user a paid customer" locally.
 *
 * Redirects an unauthenticated visitor to /login?next=<path> itself
 * (Next.js's redirect() has return type `never` and is safe to call from a
 * nested async helper -- it throws a framework-level signal that
 * propagates up through the Server Component tree, and TypeScript narrows
 * `user` to non-null for the rest of this function afterward). Every other
 * outcome is returned as a typed result so the CALLING PAGE renders an
 * honest "No Active SFB Membership" state rather than this resolver
 * silently redirecting somewhere that hides the real reason.
 *
 * WHAT COUNTS AS A CUSTOMER (the one authoritative rule, matching
 * /api/onboarding's check exactly): authenticated + owns a `businesses`
 * row + that row has a non-null plan_key. plan_key is only ever set by the
 * Won-lead provisioning flow or a verified Stripe webhook event -- never
 * by this resolver, never by a client write (RLS only grants SELECT on
 * businesses to its owner).
 *
 * HONESTY NOTE (owner should know this): plan_key being set proves the
 * business was legitimately PROVISIONED. It does NOT distinguish a
 * Stripe-verified recurring subscription from a base-plan customer
 * provisioned via the Won-lead flow, since the 3 base plans still sell
 * through Book-a-Demo rather than self-serve Stripe checkout (standing
 * product decision). This resolver never claims "Stripe verified" for a
 * base-plan customer because that would not be true. There is also no
 * `canceled` / `past_due` lifecycle state in the schema yet -- a
 * provisioned business is always treated as active. That gap is real and
 * intentionally not papered over with an invented status here; it belongs
 * to a future billing-lifecycle increment once base plans (if ever) or
 * add-on subscriptions need cancellation-driven access revocation.
 */
export async function getCustomerContext(
  currentPath: string,
  opts?: { locationId?: string }
): Promise<CustomerAccessResult> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(currentPath)}`);
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("id, legal_name, website, primary_category, plan_key")
    .eq("owner_id", user.id)
    .not("plan_key", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!business) {
    return { status: "no_customer" };
  }

  const [entitlements, { data: locations }] = await Promise.all([
    getEntitlements(supabase, business.id),
    supabase
      .from("business_locations")
      .select("id, primary_address, cities, states, service_areas, radius_miles")
      .eq("business_id", business.id),
  ]);

  const planKey = isPlanKey(business.plan_key) ? business.plan_key : null;

  // A client-provided locationId is only ever honored if it actually
  // belongs to THIS authorized business -- never trusted blindly. Falls
  // back to the first known location (today that's always at most one
  // row, since business_locations is currently one-row-per-business, not
  // one-row-per-location -- true multi-location switching needs a later
  // schema change, flagged separately, not invented here).
  const resolvedLocations = locations ?? [];
  const selectedLocationId =
    opts?.locationId && resolvedLocations.some((l) => l.id === opts.locationId)
      ? opts.locationId
      : (resolvedLocations[0]?.id ?? null);

  return {
    status: "ok",
    context: {
      userId: user.id,
      email: user.email ?? null,
      firstName: (user.user_metadata?.full_name as string | undefined)?.trim().split(/\s+/)[0] || null,
      business: {
        id: business.id,
        legalName: business.legal_name,
        website: business.website,
        primaryCategory: business.primary_category,
      },
      planKey,
      planLabel: planKey ? SFB_PLAN_LABELS[planKey] : "No active plan",
      planPriceCents: planKey ? Math.round(SFB_PLAN_PRICES[planKey] * 100) : null,
      entitlements,
      locations: resolvedLocations,
      selectedLocationId,
    },
  };
}
