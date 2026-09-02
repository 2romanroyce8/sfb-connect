import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

const leadSchema = z.object({
  businessName: z.string().min(1).optional(),
  website: z.string().optional(),
  category: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  ownerName: z.string().optional(),
  email: z.string().email(),
  phone: z.string().optional(),
});

/**
 * Lead-capture endpoint ("See How AI Understands Your Business"). Stores the
 * submission in `leads` so the pre-checkout funnel is trackable even if the
 * visitor doesn't complete payment right away.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid lead payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("leads").insert({
    business_name: parsed.data.businessName,
    website: parsed.data.website,
    category: parsed.data.category,
    city: parsed.data.city,
    state: parsed.data.state,
    owner_name: parsed.data.ownerName,
    email: parsed.data.email,
    phone: parsed.data.phone,
  });

  if (error) {
    console.error("Lead insert failed", error);
    return NextResponse.json({ error: "Could not save lead." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
