import { NextRequest, NextResponse } from "next/server";
import { getCustomerContext } from "@/lib/customerPortal/context";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { reserveCredits, InsufficientCreditsError } from "@/lib/billing/credits";

/**
 * Requests a credit-metered action. There is no automated execution
 * pipeline yet (confirmed during this build -- nothing in this codebase
 * actually runs an AI visibility check, competitor scan, etc.), so this
 * does NOT pretend to complete the action. It does the one real, honest
 * thing available: reserves the credits (via the existing safe
 * reserve-then-consume primitive, so nothing is burned yet) and logs a
 * request for SFB to complete manually. The reservation sits in
 * RESERVED until an ops/admin path completes or fails it -- that
 * completion path is a known limitation, not built in this pass.
 */
export async function POST(req: NextRequest) {
  const result = await getCustomerContext("/dashboard/actions");
  if (result.status === "no_customer") return NextResponse.json({ error: "No active membership." }, { status: 403 });

  const body = await req.json().catch(() => null);
  const actionCatalogId = body?.actionCatalogId as string | undefined;
  if (!actionCatalogId) return NextResponse.json({ error: "actionCatalogId is required." }, { status: 400 });

  const service = createSupabaseServiceClient();

  // Never trust a client-supplied credit cost -- resolve it server-side
  // from the catalog, matching the same discipline used for add-on prices.
  const { data: action, error: actionErr } = await service
    .from("action_catalog")
    .select("id, name, credit_cost")
    .eq("id", actionCatalogId)
    .eq("active", true)
    .maybeSingle();
  if (actionErr || !action) return NextResponse.json({ error: "Action not found." }, { status: 404 });

  try {
    const { reservationId } = await reserveCredits(service, {
      businessId: result.context.business.id,
      actionCatalogId: action.id,
      credits: action.credit_cost,
      relatedEntityType: "customer_portal_request",
    });

    await service.from("billing_audit_log").insert({
      business_id: result.context.business.id,
      action: "action_requested",
      actor_id: result.context.userId,
      detail: { action_catalog_id: action.id, action_name: action.name, reservation_id: reservationId },
    });

    return NextResponse.json({ ok: true, reservationId });
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json({ error: err.message }, { status: 402 });
    }
    throw err;
  }
}
