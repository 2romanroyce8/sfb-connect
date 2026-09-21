import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getStripeClient, getStripeWebhookSecret } from "@/lib/billing/stripe";
import { appendCreditTransaction, getCreditBalance } from "@/lib/billing/credits";
import type Stripe from "stripe";

// ============================================================
// Stripe is the payment/subscription AUTHORITY. This webhook is the ONLY
// place a real purchase is ever allowed to activate an entitlement, credit
// grant, or recurring add-on -- never a frontend "checkout succeeded"
// redirect, which can be spoofed, replayed, or simply closed before the
// payment actually settles.
//
// Idempotency: every event is checked against stripe_webhook_events
// (unique on stripe_event_id) BEFORE any side effect runs. Stripe
// explicitly documents that the same event can be delivered more than
// once -- this table is what makes a retry a safe no-op instead of a
// double-credited ledger or a duplicate entitlement grant. Credit grants
// ALSO carry their own idempotency_key (the Stripe event id) at the ledger
// level, so even if this guard were somehow bypassed, the ledger's own
// unique constraint is a second independent backstop.
// ============================================================

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature." }, { status: 400 });

  let event: Stripe.Event;
  try {
    const stripe = getStripeClient();
    event = stripe.webhooks.constructEvent(body, signature, getStripeWebhookSecret());
  } catch (err) {
    // Never process a payload whose signature didn't verify -- this is the
    // one thing standing between "a real Stripe event" and "anyone who
    // knows this URL exists".
    console.error("Stripe webhook signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  const service = createSupabaseServiceClient();

  // Idempotency gate: insert-first. If this event id was already recorded,
  // the unique constraint rejects the insert and we stop here -- a retry
  // never reaches any side effect below.
  const { error: dedupeError } = await service.from("stripe_webhook_events").insert({ stripe_event_id: event.id, type: event.type });
  if (dedupeError) {
    if (dedupeError.code === "23505") return NextResponse.json({ ok: true, deduped: true });
    console.error("Could not record webhook event", dedupeError);
    return NextResponse.json({ error: "Could not record webhook event." }, { status: 500 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(service, event.data.object as Stripe.Checkout.Session, event.id);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(service, event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(service, event.data.object as Stripe.Subscription);
        break;
      case "charge.refunded":
        await handleChargeRefunded(service, event.data.object as Stripe.Charge, event.id);
        break;
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(service, event.data.object as Stripe.Invoice, event.id);
        break;
      default:
        // Real events we don't act on yet -- acknowledged, not an error.
        break;
    }
  } catch (err) {
    console.error(`Stripe webhook handler failed for ${event.type}`, err);
    // The event IS recorded as seen (above) so Stripe's retry won't pile up
    // duplicate processing attempts forever, but we still report failure so
    // it's visible in Stripe's dashboard and ours.
    return NextResponse.json({ error: err instanceof Error ? err.message : "Webhook handler failed." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

async function handleCheckoutCompleted(service: ReturnType<typeof createSupabaseServiceClient>, session: Stripe.Checkout.Session, eventId: string) {
  const businessId = session.metadata?.business_id;
  const purchaseId = session.metadata?.purchase_id;
  if (!businessId || !purchaseId) {
    console.error("checkout.session.completed missing business_id/purchase_id metadata", session.id);
    return;
  }

  const { data: purchase } = await service.from("addon_purchases").select("id, purchase_type, credit_package_id, addon_product_id, quantity, amount_cents, status").eq("id", purchaseId).single();
  if (!purchase) {
    console.error("checkout.session.completed for unknown purchase", purchaseId);
    return;
  }
  if (purchase.status === "completed") return; // already handled (defense in depth alongside the webhook-event dedupe)

  await service
    .from("addon_purchases")
    .update({ status: "completed", completed_at: new Date().toISOString(), stripe_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null, stripe_subscription_id: typeof session.subscription === "string" ? session.subscription : null })
    .eq("id", purchaseId);

  if (purchase.purchase_type === "credit_package") {
    const { data: pkg } = await service.from("credit_packages").select("credits").eq("id", purchase.credit_package_id).single();
    if (pkg) {
      await appendCreditTransaction(service, {
        businessId,
        type: "PURCHASE",
        amount: pkg.credits,
        source: "stripe_checkout",
        purchaseId,
        description: "Action Credits purchased",
        idempotencyKey: `stripe_event:${eventId}`,
      });
    }
  } else if (purchase.purchase_type === "addon_recurring") {
    // The subscription itself is confirmed via customer.subscription.updated
    // (which carries the real subscription item + period end) -- here we
    // just ensure a customer_addons row exists so it shows as active even
    // before that follow-up event lands.
    // A partial unique index (one live row per business+product) now
    // backstops this at the DB level -- a 23505 here means another event
    // already created the live row; treat as an idempotent no-op.
    const { error: addonErr } = await service.from("customer_addons").insert({
      business_id: businessId,
      addon_product_id: purchase.addon_product_id,
      quantity: purchase.quantity,
      status: "active",
      stripe_subscription_id: typeof session.subscription === "string" ? session.subscription : null,
    });
    if (addonErr && addonErr.code !== "23505") throw new Error(`Could not activate add-on: ${addonErr.message}`);
  } else if (purchase.purchase_type === "addon_one_time") {
    // One-time add-ons (Knowledge Cleanup, Human Expert Review, etc.) grant
    // a one-off right, not an ongoing entitlement -- recorded as a
    // completed purchase; no customer_addons row (there's nothing ongoing
    // to track as "active").
  }

  await service.from("billing_audit_log").insert({
    business_id: businessId,
    action: "purchase_completed",
    detail: { purchase_id: purchaseId, purchase_type: purchase.purchase_type, amount_cents: purchase.amount_cents, stripe_event_id: eventId },
  });
}

async function handleSubscriptionUpdated(service: ReturnType<typeof createSupabaseServiceClient>, subscription: Stripe.Subscription) {
  const item = subscription.items.data[0];
  if (!item) return;
  const periodEnd = item.current_period_end ? new Date(item.current_period_end * 1000).toISOString() : null;
  const status = subscription.status === "active" || subscription.status === "trialing" ? "active" : subscription.cancel_at_period_end ? "canceled_at_period_end" : "canceled";

  await service
    .from("customer_addons")
    .update({ stripe_subscription_item_id: item.id, current_period_end: periodEnd, status, updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subscription.id);
}

async function handleSubscriptionDeleted(service: ReturnType<typeof createSupabaseServiceClient>, subscription: Stripe.Subscription) {
  await service
    .from("customer_addons")
    .update({ status: "canceled", canceled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subscription.id);
}

async function handleChargeRefunded(service: ReturnType<typeof createSupabaseServiceClient>, charge: Stripe.Charge, eventId: string) {
  const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : null;
  if (!paymentIntentId) return;
  const { data: purchase } = await service.from("addon_purchases").select("id, business_id, purchase_type, credit_package_id").eq("stripe_payment_intent_id", paymentIntentId).maybeSingle();
  if (!purchase) return;

  await service.from("addon_purchases").update({ status: "refunded" }).eq("id", purchase.id);

  let clampedNote: Record<string, unknown> = {};
  if (purchase.purchase_type === "credit_package") {
    const { data: pkg } = await service.from("credit_packages").select("credits").eq("id", purchase.credit_package_id).single();
    if (pkg) {
      // NEGATIVE-BALANCE GUARD: if the customer already spent some of the
      // refunded credits, only claw back what remains. The ledger can never
      // go below zero; the un-clawable remainder is recorded in the audit
      // log for the owner to handle commercially (it is a real business
      // decision, not something to hide inside a negative number).
      const currentBalance = await getCreditBalance(service, purchase.business_id);
      const clawback = Math.max(0, Math.min(pkg.credits, currentBalance));
      if (clawback > 0) {
        await appendCreditTransaction(service, {
          businessId: purchase.business_id,
          type: "REFUND",
          amount: -clawback,
          source: "stripe_refund",
          purchaseId: purchase.id,
          description: clawback < pkg.credits ? `Purchase refunded (${clawback} of ${pkg.credits} credits reclaimed -- remainder already used)` : "Purchase refunded",
          idempotencyKey: `stripe_refund:${eventId}`,
        });
      }
      if (clawback < pkg.credits) clampedNote = { credits_refunded_by_stripe: pkg.credits, credits_reclaimed: clawback, credits_already_used: pkg.credits - clawback };
    }
  } else if (purchase.purchase_type === "addon_recurring") {
    // A charge refund is NOT a subscription cancellation in Stripe -- the
    // subscription stays live until a customer.subscription.deleted event.
    // Access policy for a refunded recurring add-on is therefore decided by
    // whether the owner also cancels it in Stripe; we record the refund and
    // do not silently revoke here.
    clampedNote = { policy: "recurring add-on refund recorded; access follows Stripe subscription state" };
  } else if (purchase.purchase_type === "addon_one_time") {
    // One-time add-ons have no customer_addons row (no ongoing entitlement
    // to revoke); the refunded purchase record itself is the truth.
  }

  await service.from("billing_audit_log").insert({
    business_id: purchase.business_id,
    action: "purchase_refunded",
    detail: { purchase_id: purchase.id, stripe_event_id: eventId, ...clampedNote },
  });
}

async function handleInvoicePaymentFailed(service: ReturnType<typeof createSupabaseServiceClient>, invoice: Stripe.Invoice, eventId: string) {
  // Stripe's Invoice type moved subscription under parent.subscription_details
  // in recent API versions; tolerate both shapes without trusting either blindly.
  const inv = invoice as unknown as { subscription?: string | { id: string } | null; parent?: { subscription_details?: { subscription?: string | { id: string } | null } | null } | null };
  const raw = inv.subscription ?? inv.parent?.subscription_details?.subscription ?? null;
  const subscriptionId = typeof raw === "string" ? raw : raw?.id ?? null;
  if (!subscriptionId) return;

  const { data: rows } = await service
    .from("customer_addons")
    .update({ status: "past_due", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subscriptionId)
    .in("status", ["active", "canceled_at_period_end"])
    .select("id, business_id");

  for (const row of rows ?? []) {
    await service.from("billing_audit_log").insert({ business_id: row.business_id, action: "payment_failed", detail: { customer_addon_id: row.id, stripe_subscription_id: subscriptionId, stripe_event_id: eventId } });
  }
}
