import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { appendCreditTransaction } from "@/lib/billing/credits";
import { tier, CAPABILITY_KEYS } from "./config";

// Webhook-only. Turns a paid SFB Agent checkout into a real customer: auth
// account (invite email if new), business row with the tier, Stripe ids,
// all 8 capabilities enabled, first month of credits, audit row.
export async function provisionAgentCustomer(service: SupabaseClient, session: Stripe.Checkout.Session, eventId: string) {
  const orderId = session.metadata?.order_id;
  const t = tier(session.metadata?.plan_key);
  if (!orderId || !t || t.monthlyUsd === 0) { console.error("agent_plan checkout without order/tier metadata", session.id); return; }
  const { data: order } = await service.from("agent_plan_orders").select("*").eq("id", orderId).single();
  if (!order) { console.error("agent_plan checkout for unknown order", orderId); return; }
  if (order.status === "provisioned") return;

  const email = (session.customer_details?.email ?? order.email).toLowerCase();
  const stripeCustomerId = typeof session.customer === "string" ? session.customer : null;
  const stripeSubscriptionId = typeof session.subscription === "string" ? session.subscription : null;
  await service.from("agent_plan_orders").update({ status: "paid", paid_at: new Date().toISOString(), stripe_customer_id: stripeCustomerId, stripe_subscription_id: stripeSubscriptionId, amount_total_cents: session.amount_total ?? order.amount_total_cents }).eq("id", orderId);

  try {
    const { data: existingUser } = await service.from("users").select("id").eq("email", email).maybeSingle();
    let ownerId = existingUser?.id ?? null; let invited = false;
    if (!ownerId) {
      const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.sfbconnect.com";
      const { data: inv, error } = await service.auth.admin.inviteUserByEmail(email, { redirectTo: `${siteUrl}/login` });
      if (error || !inv?.user) throw new Error(error?.message || "Could not invite customer.");
      ownerId = inv.user.id; invited = true;
    }
    const now = new Date().toISOString();
    const fields = { plan_key: t.key, stripe_customer_id: stripeCustomerId, monthly_credit_allotment: t.credits, credits_cycle_started_at: now, is_sandbox: false, stock_profile_key: null, trial_expires_at: null, work_paused_reason: null, updated_at: now };
    const { data: existingBiz } = await service.from("businesses").select("id").eq("owner_id", ownerId).maybeSingle();
    let businessId = existingBiz?.id ?? null;
    if (businessId) {
      const { error } = await service.from("businesses").update({ ...fields, legal_name: order.business_name ?? undefined }).eq("id", businessId);
      if (error) throw new Error(error.message);
    } else {
      const { data: biz, error } = await service.from("businesses").insert({ owner_id: ownerId, legal_name: order.business_name, ...fields }).select("id").single();
      if (error || !biz) throw new Error(error?.message || "Could not create business.");
      businessId = biz.id;
    }
    await service.from("business_capabilities").upsert(CAPABILITY_KEYS.map((k) => ({ business_id: businessId, capability_key: k, enabled: true, updated_at: now })));
    await appendCreditTransaction(service, { businessId, type: "PURCHASE", amount: t.credits, source: "sfb_agent_plan", description: `${t.name} plan — monthly credits`, idempotencyKey: `stripe_event:${eventId}` });
    await service.from("agent_plan_orders").update({ status: "provisioned", provisioned_at: now, business_id: businessId }).eq("id", orderId);
    await service.from("billing_audit_log").insert({ business_id: businessId, action: "agent_plan_provisioned", detail: { order_id: orderId, plan_key: t.key, invited, stripe_subscription_id: stripeSubscriptionId, stripe_event_id: eventId } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await service.from("agent_plan_orders").update({ status: "failed", error: msg }).eq("id", orderId);
    throw e;
  }
}

/** Renewal: monthly allotment spends first and never rolls over, so any
 * unspent allotment from the previous cycle expires before the new grant. */
export async function grantAgentRenewalCredits(service: SupabaseClient, invoice: Stripe.Invoice, eventId: string) {
  const inv = invoice as unknown as { billing_reason?: string; subscription?: string | { id: string } | null; parent?: { subscription_details?: { subscription?: string | { id: string } | null } | null } | null };
  if (inv.billing_reason !== "subscription_cycle") return;
  const raw = inv.subscription ?? inv.parent?.subscription_details?.subscription ?? null;
  const subscriptionId = typeof raw === "string" ? raw : raw?.id ?? null;
  if (!subscriptionId) return;
  const { data: order } = await service.from("agent_plan_orders").select("plan_key, business_id").eq("stripe_subscription_id", subscriptionId).eq("status", "provisioned").maybeSingle();
  const t = tier(order?.plan_key);
  if (!order?.business_id || !t) return;
  await expireUnspentAllotment(service, order.business_id, `stripe_event:${eventId}:expire`);
  await appendCreditTransaction(service, { businessId: order.business_id, type: "PURCHASE", amount: t.credits, source: "sfb_agent_plan_renewal", description: `${t.name} plan — monthly credits (renewal)`, idempotencyKey: `stripe_event:${eventId}` });
  await service.from("businesses").update({ credits_cycle_started_at: new Date().toISOString(), work_paused_reason: null }).eq("id", order.business_id);
}

/** Allotment spends first: whatever is left of this cycle's allotment (allotment granted − usage this cycle, floored at 0) expires. Top-ups are untouched. */
export async function expireUnspentAllotment(service: SupabaseClient, businessId: string, idempotencyKey: string) {
  const { data: b } = await service.from("businesses").select("monthly_credit_allotment, credits_cycle_started_at").eq("id", businessId).single();
  if (!b?.monthly_credit_allotment || !b.credits_cycle_started_at) return;
  const { data: usage } = await service.from("credit_transactions").select("amount").eq("business_id", businessId).eq("type", "USAGE").gte("created_at", b.credits_cycle_started_at);
  const spent = (usage ?? []).reduce((s, r) => s + Math.abs(r.amount), 0);
  const leftover = Math.max(0, b.monthly_credit_allotment - spent);
  if (leftover === 0) return;
  await appendCreditTransaction(service, { businessId, type: "EXPIRATION", amount: -leftover, source: "allotment_cycle_end", description: `Unused monthly credits expired (${leftover}) — top-ups carried over`, idempotencyKey });
}

export async function endAgentPlan(service: SupabaseClient, subscription: Stripe.Subscription, eventId: string) {
  const { data: order } = await service.from("agent_plan_orders").select("id, business_id, plan_key").eq("stripe_subscription_id", subscription.id).maybeSingle();
  if (!order) return;
  await service.from("agent_plan_orders").update({ status: "canceled" }).eq("id", order.id);
  if (order.business_id) {
    await service.from("businesses").update({ plan_key: null, monthly_credit_allotment: 0, updated_at: new Date().toISOString() }).eq("id", order.business_id).eq("plan_key", order.plan_key);
    await service.from("billing_audit_log").insert({ business_id: order.business_id, action: "agent_plan_canceled", detail: { order_id: order.id, plan_key: order.plan_key, stripe_subscription_id: subscription.id, stripe_event_id: eventId } });
  }
}
