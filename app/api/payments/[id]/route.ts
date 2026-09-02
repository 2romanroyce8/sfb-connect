import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";

/**
 * Lets the customer attach a note / screenshot link after they've actually
 * sent the Cash App / PayPal / Zelle payment. Only works on their own
 * still-pending submission — once an admin reviews it, it's locked.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const { customerNote, proofScreenshotUrl } = body || {};

  const service = createSupabaseServiceClient();
  const { data: payment } = await service
    .from("payments")
    .select("id, user_id, status")
    .eq("id", params.id)
    .single();

  if (!payment || payment.user_id !== user.id) {
    return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  }
  if (payment.status !== "pending_review") {
    return NextResponse.json({ error: "This payment has already been reviewed." }, { status: 409 });
  }

  const { error } = await service
    .from("payments")
    .update({
      customer_note: customerNote ?? null,
      proof_screenshot_url: proofScreenshotUrl ?? null,
    })
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
