import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { generateReferenceCode } from "@/lib/referenceCode";
import { ANNUAL_AMOUNT_CENTS } from "@/lib/paymentsData";

const METHODS = ["cashapp", "paypal", "zelle"];

/**
 * Creates a pending payment submission for the signed-in customer. Returns
 * the existing pending/confirmed payment instead of creating a duplicate if
 * one already exists — the reference code needs to stay stable once a
 * customer has started including it in a real Cash App / PayPal / Zelle note.
 */
export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const method = body?.method as string | undefined;
  if (!method || !METHODS.includes(method)) {
    return NextResponse.json({ error: "Invalid payment method." }, { status: 400 });
  }

  const service = createSupabaseServiceClient();

  const { data: existing } = await service
    .from("payments")
    .select("*")
    .eq("user_id", user.id)
    .in("status", ["pending_review", "confirmed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ payment: existing });
  }

  let referenceCode = generateReferenceCode();
  let insertError = null;
  let inserted = null;

  // Reference codes are unique — retry a couple of times on the astronomically
  // unlikely collision rather than failing the request.
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await service
      .from("payments")
      .insert({
        user_id: user.id,
        method,
        reference_code: referenceCode,
        amount_cents: ANNUAL_AMOUNT_CENTS,
      })
      .select("*")
      .single();

    if (!error) {
      inserted = data;
      insertError = null;
      break;
    }
    insertError = error;
    referenceCode = generateReferenceCode();
  }

  if (insertError || !inserted) {
    console.error("Payment creation failed", insertError);
    return NextResponse.json({ error: "Could not create payment." }, { status: 500 });
  }

  return NextResponse.json({ payment: inserted });
}
