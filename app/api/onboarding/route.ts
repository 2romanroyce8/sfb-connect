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
 * Finalizes onboarding. Requires an authenticated Supabase session — the
 * old self-serve Cash App / PayPal / Zelle checkout (and the "confirmed
 * payment" gate that used to sit in front of this route) has been removed
 * in favor of a demo-first sales process, so there is no automated payment
 * confirmation to check here anymore.
 *
 * On success: creates the business and all related intake rows, a project
 * in "submitted" status, a day-0 audit, and the membership record.
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

  const { data: businessRow, error: businessErr } = await service
    .from("businesses")
    .insert({
      owner_id: user.id,
      legal_name: business.legalName,
      website: business.website,
      primary_category: business.primaryCategory,
      description: business.description,
      years_in_business: business.yearsInBusiness,
    })
    .select("id")
    .single();

  if (businessErr || !businessRow) {
    console.error(businessErr);
    return NextResponse.json({ error: "Could not create business." }, { status: 500 });
  }

  const businessId = businessRow.id;

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

  const renewsAt = new Date();
  renewsAt.setMonth(renewsAt.getMonth() + 1);
  await service.from("subscriptions_or_annual_memberships").insert({
    business_id: businessId,
    payment_id: null,
    status: "active",
    renews_at: renewsAt.toISOString(),
  });

  return NextResponse.json({ ok: true, businessId, projectId: projectRow?.id });
}
