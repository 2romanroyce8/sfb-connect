import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { appendCreditTransaction } from "@/lib/billing/credits";
import { sendEmail, trialWelcomeEmail } from "@/lib/email/resend";
import { readCache } from "@/lib/analyzer/run";
import { firstThreeTasks } from "@/lib/analyzer/narrate";
import { createTask } from "@/lib/agent/tasks/queue";
import { CAPABILITY_KEYS, TRIAL_TIER, TRIAL_IS_FREE, stockProfile, type CapabilityKey } from "./config";
import { fetchAgentModules } from "./modules";
import { ensureTrialPrice } from "./stripe";

// ============================================================
// THE 5-DAY TRIAL (2026-10-11)
//
// FREE (TRIAL_IS_FREE, Roman 18:09 ET): /api/trial/start provisions the
// sandbox business immediately via createTrialBusiness — no order, no Stripe,
// no card. The paid path below stays wired for a non-zero `trialUsd`:
// the trial becomes an order like a paid plan. /api/trial/start creates the
// account and a pending `agent_plan_orders` row (plan_key 'trial'), Stripe
// Checkout collects the dollar, and the sandbox business — stock profile,
// 128 credits, 3 capabilities, 5-day expiry — is provisioned ONLY once
// Stripe says the session is paid. Two callers can report that: the webhook
// and the success page (which reads the session from Stripe server-side,
// never from the browser). `provisionTrialOrder` is therefore idempotent
// and claim-based: whoever flips the order pending→paid provisions; the
// other sees "claimed" and does nothing.
// ============================================================

export const TRIAL_PRICE_CENTS = TRIAL_TIER.trialUsd * 100;
export type TrialSetup = { name: string; stock_profile: string; capabilities: CapabilityKey[]; scan_domain: string | null };

/** Access ends exactly `trialDays` after the dollar cleared — never from signup time. */
export const trialExpiry = (paidAt: Date) => new Date(paidAt.getTime() + TRIAL_TIER.trialDays * 86400000);

/** Validates wizard input into a TrialSetup, or returns the first problem. */
export function parseTrialSetup(b: { name?: unknown; stockProfile?: unknown; capabilities?: unknown; scanDomain?: unknown }): { setup: TrialSetup } | { error: string } {
  const name = typeof b.name === "string" ? b.name.trim().slice(0, 80) : "";
  const profile = stockProfile(typeof b.stockProfile === "string" ? b.stockProfile : undefined);
  const caps = Array.from(new Set((Array.isArray(b.capabilities) ? b.capabilities : []).filter((c): c is CapabilityKey => typeof c === "string" && (CAPABILITY_KEYS as string[]).includes(c))));
  const scanDomain = typeof b.scanDomain === "string" && /^[a-z0-9.-]{3,200}$/i.test(b.scanDomain) ? b.scanDomain.toLowerCase() : null;
  if (name.length < 2) return { error: "Enter your name." };
  if (!profile) return { error: "Pick a sample business." };
  if (caps.length !== TRIAL_TIER.capabilityLimit) return { error: `Pick exactly ${TRIAL_TIER.capabilityLimit} capabilities to watch.` };
  return { setup: { name, stock_profile: profile.key, capabilities: caps, scan_domain: scanDomain } };
}

type OrderRow = { id: string; owner_id: string | null; email: string; status: string; setup: TrialSetup; business_id: string | null; stripe_checkout_session_id: string | null; created_at: string };

/** The signed-in user's unpaid trial order, if any (newest first). */
export async function pendingTrialOrder(service: SupabaseClient, ownerId: string): Promise<OrderRow | null> {
  const { data } = await service.from("agent_plan_orders").select("id, owner_id, email, status, setup, business_id, stripe_checkout_session_id, created_at").eq("owner_id", ownerId).eq("plan_key", "trial").in("status", ["pending", "failed"]).is("business_id", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return (data as OrderRow | null) ?? null;
}

/** Creates (or re-uses) the pending order and opens a fresh Stripe Checkout for it. Amount comes from config; the browser sends nothing about money. */
export { TRIAL_IS_FREE };

export async function startTrialCheckout(service: SupabaseClient, stripe: Stripe, input: { ownerId: string; email: string; setup: TrialSetup; origin: string; reuseOrderId?: string | null }): Promise<{ orderId: string; checkoutUrl: string }> {
  const priceId = await ensureTrialPrice(stripe);
  const profile = stockProfile(input.setup.stock_profile)!;
  let orderId = input.reuseOrderId ?? null;
  if (orderId) {
    await service.from("agent_plan_orders").update({ setup: input.setup, status: "pending", error: null }).eq("id", orderId).eq("owner_id", input.ownerId).eq("plan_key", "trial");
  } else {
    const { data: order, error } = await service.from("agent_plan_orders").insert({ plan_key: "trial", email: input.email, business_name: `${profile.name} (demo)`, owner_id: input.ownerId, setup: input.setup, billing_interval: "month", amount_total_cents: TRIAL_PRICE_CENTS }).select("id").single();
    if (error || !order) throw new Error(error?.message || "Could not start the trial order.");
    orderId = order.id as string;
  }
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: input.email,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${input.origin}/start/welcome?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${input.origin}/start?checkout=canceled`,
    metadata: { kind: "agent_trial", order_id: orderId, owner_id: input.ownerId },
    payment_intent_data: { metadata: { kind: "agent_trial", order_id: orderId } },
    allow_promotion_codes: false,
  });
  if (!session.url) throw new Error("Stripe returned no checkout URL.");
  await service.from("agent_plan_orders").update({ stripe_checkout_session_id: session.id }).eq("id", orderId);
  return { orderId, checkoutUrl: session.url };
}

export type ProvisionTrialResult = { state: "provisioned" | "already" | "claimed" | "not_paid" | "unknown_order"; businessId: string | null };

/** Turns a PAID trial checkout into the sandbox business. Safe to call from the webhook and the success page in any order. */
export async function provisionTrialOrder(service: SupabaseClient, session: Stripe.Checkout.Session, source: { via: "webhook" | "success_page"; eventId?: string }): Promise<ProvisionTrialResult> {
  if (session.metadata?.kind !== "agent_trial") return { state: "unknown_order", businessId: null };
  if (session.payment_status !== "paid") return { state: "not_paid", businessId: null };
  const orderId = session.metadata.order_id;
  const { data: order } = await service.from("agent_plan_orders").select("id, owner_id, email, status, setup, business_id, stripe_checkout_session_id, created_at").eq("id", orderId).eq("plan_key", "trial").maybeSingle();
  if (!order) { console.error("[trial] paid checkout for unknown order", session.id); return { state: "unknown_order", businessId: null }; }
  const o = order as OrderRow;
  if (o.status === "provisioned" && o.business_id) return { state: "already", businessId: o.business_id };
  if (!o.owner_id) { console.error("[trial] order has no owner", o.id); return { state: "unknown_order", businessId: null }; }

  // Claim: only the caller that flips pending/failed → paid provisions.
  const paidAt = new Date();
  const { data: claimed } = await service.from("agent_plan_orders").update({
    status: "paid", paid_at: paidAt.toISOString(), stripe_customer_id: typeof session.customer === "string" ? session.customer : null,
    stripe_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null, amount_total_cents: session.amount_total ?? TRIAL_PRICE_CENTS,
  }).eq("id", o.id).in("status", ["pending", "failed"]).select("id");
  if (!claimed?.length) return { state: "claimed", businessId: null };

  try {
    const businessId = await createTrialBusiness(service, { ownerId: o.owner_id, email: (session.customer_details?.email ?? o.email).toLowerCase(), setup: o.setup, paidAt, orderId: o.id, paidCents: session.amount_total ?? TRIAL_PRICE_CENTS, stripeEventId: source.eventId ?? null, via: source.via });
    await service.from("agent_plan_orders").update({ status: "provisioned", provisioned_at: new Date().toISOString(), business_id: businessId }).eq("id", o.id);
    return { state: "provisioned", businessId };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await service.from("agent_plan_orders").update({ status: "failed", error: msg }).eq("id", o.id);
    throw e;
  }
}

/** The sandbox business itself: stock profile, 128 PROMOTIONAL credits, the 3 chosen capabilities, expiry = paid + 5 days, audit, analyzer tie-in, welcome email. */
export async function createTrialBusiness(service: SupabaseClient, p: { ownerId: string; email: string; setup: TrialSetup; paidAt: Date; orderId: string | null; paidCents: number; stripeEventId: string | null; via: "webhook" | "success_page" | "free" }): Promise<string> {
  const profile = stockProfile(p.setup.stock_profile);
  if (!profile) throw new Error(`Unknown stock profile ${p.setup.stock_profile}.`);
  const caps = p.setup.capabilities.filter((c) => (CAPABILITY_KEYS as string[]).includes(c));
  const expires = trialExpiry(p.paidAt).toISOString();
  await service.from("users").update({ full_name: p.setup.name }).eq("id", p.ownerId);
  const { data: biz, error: bErr } = await service.from("businesses").insert({ owner_id: p.ownerId, legal_name: `${profile.name} (demo)`, website: profile.website, primary_category: profile.category, plan_key: "trial", is_sandbox: true, stock_profile_key: profile.key, trial_expires_at: expires, monthly_credit_allotment: TRIAL_TIER.credits, credits_cycle_started_at: p.paidAt.toISOString(), analyzer_scan_domain: p.setup.scan_domain }).select("id").single();
  if (bErr || !biz) throw new Error(bErr?.message || "Could not create the demo business.");
  await service.from("business_capabilities").insert(CAPABILITY_KEYS.map((k) => ({ business_id: biz.id, capability_key: k, enabled: caps.includes(k) })));
  await appendCreditTransaction(service, { businessId: biz.id, type: "PROMOTIONAL", amount: TRIAL_TIER.credits, source: "trial_grant", description: `Trial credits (${TRIAL_TIER.credits}) — expire ${new Date(expires).toLocaleDateString("en-US")}`, idempotencyKey: `trial:${biz.id}` });
  await service.from("billing_audit_log").insert({ business_id: biz.id, action: "trial_started", detail: { order_id: p.orderId, paid_cents: p.paidCents, provisioned_via: p.via, stripe_event_id: p.stripeEventId, stock_profile: profile.key, capabilities: caps, expires_at: expires, scan_domain: p.setup.scan_domain } });
  // Trial tie-in: the "first 3 tasks" mirror the preview's top findings on LIVE capabilities only. Best-effort.
  if (p.setup.scan_domain) {
    try {
      const [scan, modules] = await Promise.all([readCache(service, p.setup.scan_domain), fetchAgentModules()]);
      if (scan) {
        for (const t of firstThreeTasks(scan.findings, modules)) {
          await createTask("hyperagent", { title: t.title, owner_agent: "atlas", context: `${t.context}\nTrial business: ${biz.id} (sandbox, stock data — demonstrate on the demo business; no real sends). Preview domain: ${p.setup.scan_domain}.`, priority: "normal", requires_review: true, reviewer_agent: "hyperagent" });
        }
      }
    } catch (e) { console.error("[trial] first-tasks seed failed:", e instanceof Error ? e.message : e); }
  }
  void sendEmail({ to: p.email, ...trialWelcomeEmail({ name: p.setup.name, credits: TRIAL_TIER.credits, days: TRIAL_TIER.trialDays, businessName: `${profile.name} (demo)` }) });
  return biz.id as string;
}

/** A refunded trial dollar ends the access: expiry moves to now, order is canceled, audit row written. Credits already spent stay spent. */
export async function endRefundedTrial(service: SupabaseClient, paymentIntentId: string, eventId: string): Promise<boolean> {
  const { data: order } = await service.from("agent_plan_orders").select("id, business_id, status").eq("plan_key", "trial").eq("stripe_payment_intent_id", paymentIntentId).maybeSingle();
  if (!order) return false;
  const now = new Date().toISOString();
  await service.from("agent_plan_orders").update({ status: "canceled" }).eq("id", order.id);
  if (order.business_id) {
    await service.from("businesses").update({ trial_expires_at: now, work_paused_reason: "trial_refunded", updated_at: now }).eq("id", order.business_id).eq("plan_key", "trial");
    await service.from("billing_audit_log").insert({ business_id: order.business_id, action: "trial_refunded", detail: { order_id: order.id, stripe_event_id: eventId, stripe_payment_intent_id: paymentIntentId } });
  }
  return true;
}
