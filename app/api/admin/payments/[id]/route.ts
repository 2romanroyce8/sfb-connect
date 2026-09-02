import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminGuard";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

/**
 * Admin confirms or rejects a manually-submitted Cash App / PayPal / Zelle
 * payment. There is no webhook for these methods — this is the actual
 * moment of truth, so it should only be clicked after checking the
 * reference code against money that has actually landed in the account.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status });

  const body = await req.json().catch(() => null);
  const action = body?.action as "confirm" | "reject" | undefined;
  const rejectionReason = body?.rejectionReason as string | undefined;

  if (action !== "confirm" && action !== "reject") {
    return NextResponse.json({ error: "action must be 'confirm' or 'reject'." }, { status: 400 });
  }

  const service = createSupabaseServiceClient();

  const { data: payment } = await service
    .from("payments")
    .select("id, status")
    .eq("id", params.id)
    .single();

  if (!payment) return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  if (payment.status !== "pending_review") {
    return NextResponse.json({ error: "Payment has already been reviewed." }, { status: 409 });
  }

  const { error } = await service
    .from("payments")
    .update({
      status: action === "confirm" ? "confirmed" : "rejected",
      reviewed_by: guard.userId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: action === "reject" ? rejectionReason || null : null,
    })
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
