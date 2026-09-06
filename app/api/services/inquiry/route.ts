import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SERVICE_INTERESTS } from "@/lib/marketing/serviceInterests";

const inquirySchema = z.object({
  serviceInterest: z.enum(SERVICE_INTERESTS),
  businessName: z.string().min(1),
  name: z.string().min(1).optional(),
  email: z.string().email(),
  phone: z.string().optional(),
  website: z.string().optional(),
  message: z.string().optional(),
});

// Public lead-capture endpoint for every "Request a Quote" / "Discuss X" /
// "Build My Website" CTA across the new service pages. Uses the
// anon-key session client (not the service role) so the leads_public_insert
// RLS policy is what actually authorizes the write — a visitor can INSERT
// but genuinely cannot read back other submissions, which the service
// client would silently bypass either way.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = inquirySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid inquiry payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("leads").insert({
    business_name: parsed.data.businessName,
    owner_name: parsed.data.name,
    email: parsed.data.email,
    phone: parsed.data.phone,
    website: parsed.data.website,
    service_interest: parsed.data.serviceInterest,
    message: parsed.data.message,
  });

  if (error) {
    console.error("Service inquiry insert failed", error);
    return NextResponse.json({ error: "Could not submit your request. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
