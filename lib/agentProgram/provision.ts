import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { appendCreditTransaction } from "@/lib/billing/credits";
import { agentPlan } from "./config";

// Called by the Stripe webhook (the only trusted trigger). Turns a paid
// SFB Agent checkout into a real customer: auth account (invite email if
// new), business row with the plan, Stripe ids, first month of credits,
// audit row. Idempotent per order; re-deliveries are no-ops.
export async function provisionAgentCustomer(service: SupabaseClient, session: Stripe.Checkout.Session, eventId: string) {
  const orderId = session.metadata?.order_id;
  const planKey = session.metadata?.plan_key ?? "";
  const plan = agentPlan(planKey);
  if (!orderId || !plan) { console.error("agent_plan checkout without order/plan metadata", session.id); return; }

  const { data: order } = await service.from("agent_plan_orders").select("*").eq("id", orderId).single();
  if (!order) { console.error("agent_plan checkout for unknown order", orderId); return; }
  if (order.status === "provisioned") return;

  const email = (session.customer_details?.email ?? order.email).toLowerCase();
  const stripeCustomerId = typeof session.customer === "string" ? session.customer : null;
  const stripeSubscriptionId = typeof session.subscription === "string" ? session.subscription : null;
  await service.from("agent_plan_orders").update({ status: "paid", paid_at: new Date().toISOString(), stripe_customer_id: stripeCustomerId, stripe_subscription_id: stripeSubscriptionId, amount_total_cents: session.amount_total ?? order.amount_total_cents }).eq("id", orderId);

  try {
    // Reuse an existing account for this email; otherwise invite (the
    // invite email is how the new customer sets a password and signs in).
    const { data: existingUser } = await service.from("users").select("id").eq("email", email).maybeSingle();
    let ownerId = existingUser?.id ?? null;
    let invited = false;
    if (!ownerId) {
      const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.sfbconnect.com";
      const { data: inv, error } = await service.auth.admin.inviteUserByEmail(email, { redirectTo: `${siteUrl}/login` });
      if (error || !inv?.user) throw new Error(error?.message || "Could not invite customer.");
      ownerId = inv.user.id; invited = true;
    }

    // One business per owner today: upgrade it in place if it exists.
    const { data: existingBiz } = await service.from("businesses").select("id").eq("owner_id", ownerId).maybeSingle();
    let businessId = existingBiz?.id ?? null;
    if (businessId) {
      const { error } = await service.from("businesses").update({ plan_key: plan.key, stripe_customer_id: stripeCustomerId, legal_name: order.business_name ?? undefined, updated_at: new Date().toISOString() }).eq("id", businessId);
      if (error) throw new Error(error.message);
    } else {
      const { data: biz, error } = await service.from("businesses").insert({ owner_id: ownerId, legal_name: order.business_name, plan_key: plan.key, stripe_customer_id: stripeCustomerId }).select("id").single();
      if (error || !biz) throw new Error(error?.message || "Could not create business.");
      businessId = biz.id;
    }

    await appendCreditTransaction(service, { businessId, type: "PURCHASE", amount: plan.creditsPerMonth, source: "sfb_agent_plan", description: `${plan.name} plan — monthly credits`, idempotencyKey: `stripe_event:${eventId}` });

    await service.from("agent_plan_orders").update({ status: "provisioned", provisioned_at: new Date().toISOString(), business_id: businessId }).eq("id", orderId);
    await service.from("billing_audit_log").insert({ business_id: businessId, action: "agent_plan_provisioned", detail: { order_id: orderId, plan_key: plan.key, invited, stripe_subscription_id: stripeSubscriptionId, stripe_event_id: eventId } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await service.from("agent_plan_orders").update({ status: "failed", error: msg }).eq("id", orderId);
    throw e;
  }
}

/** Renewal: each new billing cycle grants the plan's monthly credits. */
export async function grantAgentRenewalCredits(service: SupabaseClient, invoice: Stripe.Invoice, eventId: string) {
  const inv = invoice as unknown as { billing_reason?: string; subscription?: string | { id: string } | null; parent?: { subscription_details?: { subscription?: string | { id: string } | null; metadata?: Record<string, string> | null } | null } | null; subscription_details?: { metadata?: Record<string, string> | null } | null };
  if (inv.billing_reason !== "subscription_cycle") return;
  const raw = inv.subscription ?? inv.parent?.subscription_details?.subscription ?? null;
  const subscriptionId = typeof raw === "string" ? raw : raw?.id ?? null;
  if (!subscriptionId) return;
  const { data: order } = await service.from("agent_plan_orders").select("plan_key, business_id").eq("stripe_subscription_id", subscriptionId).eq("status", "provisioned").maybeSingle();
  if (!order?.business_id) return;
  const plan = agentPlan(order.plan_key);
  if (!plan) return;
  await appendCreditTransaction(service, { businessId: order.business_id, type: "PURCHASE", amount: plan.creditsPerMonth, source: "sfb_agent_plan_renewal", description: `${plan.name} plan — monthly credits (renewal)`, idempotencyKey: `stripe_event:${eventId}` });
}

/** Cancellation: the subscription ended in Stripe, so the plan ends here. */
export async function endAgentPlan(service: SupabaseClient, subscription: Stripe.Subscription, eventId: string) {
  const { data: order } = await service.from("agent_plan_orders").select("id, business_id, plan_key").eq("stripe_subscription_id", subscription.id).maybeSingle();
  if (!order) return;
  await service.from("agent_plan_orders").update({ status: "canceled" }).eq("id", order.id);
  if (order.business_id) {
    await service.from("businesses").update({ plan_key: null, updated_at: new Date().toISOString() }).eq("id", order.business_id).eq("plan_key", order.plan_key);
    await service.from("billing_audit_log").insert({ business_id: order.business_id, action: "agent_plan_canceled", detail: { order_id: order.id, plan_key: order.plan_key, stripe_subscription_id: subscription.id, stripe_event_id: eventId } });
  }
}
