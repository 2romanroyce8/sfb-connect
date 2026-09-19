import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createSupabaseServerClient,
  createSupabaseServiceClient,
} from "@/lib/supabase/server";

const onboardingSchema = z.object({
  business: z.object({
    legalName: z.string().min(1),
    website: z.string().optional(),
    primaryCategory: z.string().optional(),
    description: z.string().optional(),
    yearsInBusiness: z.string().optional(),
  }),
  location: z.object({
    primaryAddress: z.string().optional(),
    serviceAreas: z.array(z.string()).optional(),
    cities: z.array(z.string()).optional(),
    states: z.array(z.string()).optional(),
    radiusMiles: z.number().optional(),
  }),
  services: z.object({
    primaryService: z.string().optional(),
    additionalServices: z.array(z.string()).optional(),
    specialties: z.array(z.string()).optional(),
    priceRange: z.string().optional(),
    idealCustomer: z.string().optional(),
  }),
  presence: z.object({
    googleBusinessProfileUrl: z.string().optional(),
    facebook: z.string().optional(),
    instagram: z.string().optional(),
    tiktok: z.string().optional(),
    linkedin: z.string().optional(),
    youtube: z.string().optional(),
    otherDirectories: z.array(z.string()).optional(),
  }),
  competitors: z.array(z.string()).optional(),
});

/**
 * Finalizes onboarding intake for an ALREADY-AUTHORIZED paid customer.
 *
 * SECURITY: this route used to INSERT a brand new `businesses` row for
 * whoever called it, then insert a `subscriptions_or_annual_memberships`
 * row with `status: "active"` and `payment_id: null` -- i.e. it was
 * granting free, self-served "active" paid access to literally any
 * authenticated Supabase user, with no payment or entitlement check of any
 * kind. That has been removed.
 *
 * The corrected rule: onboarding may CONFIGURE an already-authorized
 * customer's business (fill in location/services/social/competitor intake
 * details); it may never CREATE the authorization itself. Authorization
 * (an active `businesses.plan_key`) is only ever established by the Won
 * Sales-OS pipeline transition (see app/api/team/leads/[id]/stage/route.ts)
 * or a verified server-side Stripe event -- never by this route, and never
 * by a client-supplied business id/plan/status. This route now REQUIRES an
 * existing `businesses` row owned by the caller with a non-null plan_key
 * before it will touch anything, and it no longer writes to
 * subscriptions_or_annual_memberships at all (that legacy table has never
 * had a client-writable RLS policy -- the only hole was this route being
 * too permissive server-side).
 */
export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = onboardingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid onboarding payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const service = createSupabaseServiceClient();

  // Ensure a public.users profile row exists.
  await service
    .from("users")
    .upsert({ id: user.id, email: user.email, role: "customer" }, { onConflict: "id" });

  const { business, location, services, presence, competitors } = parsed.data;

  // Resolve the caller's ALREADY-AUTHORIZED business server-side -- never
  // trust a client-supplied business id, and never create one here. A
  // non-null plan_key is only ever set by the Won-lead provisioning flow
  // or a verified Stripe webhook, so this is the real authorization check.
  const { data: businessRow, error: businessErr } = await service
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .not("plan_key", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (businessErr || !businessRow) {
    return NextResponse.json(
      {
        error:
          "No active SFB membership found for this account. Onboarding intake is only available to existing paid customers.",
      },
      { status: 403 }
    );
  }

  const businessId = businessRow.id;

  // Update descriptive fields on the already-authorized business. This is
  // a plain UPDATE (service-role, so RLS's now-select-only owner policy
  // doesn't apply here) -- never touches owner_id, plan_key,
  // stripe_customer_id, or source_lead_id.
  const { error: updateErr } = await service
    .from("businesses")
    .update({
      legal_name: business.legalName,
      website: business.website,
      primary_category: business.primaryCategory,
      description: business.description,
      years_in_business: business.yearsInBusiness,
    })
    .eq("id", businessId);

  if (updateErr) {
    console.error(updateErr);
    return NextResponse.json({ error: "Could not update business." }, { status: 500 });
  }

  await Promise.all([
    service.from("business_locations").insert({
      business_id: businessId,
      primary_address: location.primaryAddress,
      service_areas: location.serviceAreas,
      cities: location.cities,
      states: location.states,
      radius_miles: location.radiusMiles,
    }),
    service.from("business_services").insert({
      business_id: businessId,
      primary_service: services.primaryService,
      additional_services: services.additionalServices,
      specialties: services.specialties,
      price_range: services.priceRange,
      ideal_customer: services.idealCustomer,
    }),
    service.from("business_social_profiles").insert({
      business_id: businessId,
      google_business_profile_url: presence.googleBusinessProfileUrl,
      facebook: presence.facebook,
      instagram: presence.instagram,
      tiktok: presence.tiktok,
      linkedin: presence.linkedin,
      youtube: presence.youtube,
      other_directories: presence.otherDirectories,
    }),
    ...(competitors || [])
      .filter(Boolean)
      .map((name) =>
        service.from("competitors").insert({ business_id: businessId, name })
      ),
  ]);

  // Idempotency: this route may now legitimately be called more than once
  // by an already-authorized customer (e.g. re-submitting intake details).
  // Never create a second workflow container for the same business.
  const { data: existingProject } = await service
    .from("projects")
    .select("id")
    .eq("business_id", businessId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let projectId = existingProject?.id ?? null;

  if (!projectId) {
    const targetCompletion = new Date();
    targetCompletion.setDate(targetCompletion.getDate() + 14);

    const { data: projectRow } = await service
      .from("projects")
      .insert({
        business_id: businessId,
        status: "submitted",
        target_completion_at: targetCompletion.toISOString(),
      })
      .select("id")
      .single();

    if (projectRow) {
      projectId = projectRow.id;
      await service.from("audits").insert({
        project_id: projectRow.id,
        audit_stage: "intake",
      });
      await service.from("project_status_history").insert({
        project_id: projectRow.id,
        status: "submitted",
        note: "Business intake completed via onboarding.",
      });
    }
  }

  // NOTE: this route intentionally no longer writes to
  // subscriptions_or_annual_memberships. That was the actual vulnerability
  // -- it self-granted a "status: active" membership with no payment_id.
  // Paid/active status is now determined ENTIRELY by businesses.plan_key +
  // the entitlement engine (lib/billing/entitlements.ts), set only by the
  // Won-lead provisioning flow or a verified Stripe webhook event. Whether
  // subscriptions_or_annual_memberships should still be written by any
  // path, migrated, or retired is a separate open question (see the
  // legacy-table audit) -- not decided by this security-only pass.

  return NextResponse.json({ ok: true, businessId, projectId });
}
