// Done-for-you install (onboarding step 9). The ONLY hard-coded dollar figure in
// onboarding: $8,000 one-time — Rome's number, cleared 2026-10-12. The monthly
// retainer has no price yet and is shown as "Talk to us" (never invented).
import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { getStripeClient } from "@/lib/billing/stripe";
import { createTask } from "@/lib/agent/tasks/queue";
import { alertOwners, esc } from "@/lib/notify/ownerAlerts";

import { DFY_KEY, DFY_INSTALL_USD, DFY_LOOKUP_KEY } from "./dfyConstants";
export { DFY_KEY, DFY_INSTALL_USD, DFY_LOOKUP_KEY, DFY_OFFER_LINE } from "./dfyConstants";

/** The addon_products row is the catalog truth; the Stripe Price is created once by lookup key and pinned to it. */
export async function ensureDfyPrice(stripe: Stripe, service: SupabaseClient): Promise<{ productRowId: string; priceId: string; cents: number }> {
  const { data: row } = await service.from("addon_products").select("id, base_price_cents, stripe_price_id, stripe_product_id, active").eq("key", DFY_KEY).single();
  if (!row || !row.active) throw new Error("The done-for-you install isn't in the catalog.");
  if (row.base_price_cents !== DFY_INSTALL_USD * 100) throw new Error(`Catalog price (${row.base_price_cents}) disagrees with the cleared $${DFY_INSTALL_USD} — refusing to charge.`);
  if (row.stripe_price_id) return { productRowId: row.id, priceId: row.stripe_price_id, cents: row.base_price_cents };
  const existing = await stripe.prices.list({ lookup_keys: [DFY_LOOKUP_KEY], active: true, limit: 1 });
  let price = existing.data[0];
  if (!price) {
    const product = row.stripe_product_id ? { id: row.stripe_product_id } : await stripe.products.create({ name: "SFB Connect — Done-for-you install", metadata: { addon_key: DFY_KEY } });
    price = await stripe.prices.create({ product: product.id, currency: "usd", unit_amount: row.base_price_cents, lookup_key: DFY_LOOKUP_KEY, nickname: "Done-for-you install (one-time)", metadata: { kind: "dfy_install" } });
  }
  const productId = typeof price.product === "string" ? price.product : price.product.id;
  await service.from("addon_products").update({ stripe_price_id: price.id, stripe_product_id: productId, updated_at: new Date().toISOString() }).eq("id", row.id);
  return { productRowId: row.id, priceId: price.id, cents: row.base_price_cents };
}

/** Starts the $8,000 checkout for a business; returns the hosted checkout URL. Reuses addon_purchases so the existing webhook completes it. */
export async function startDfyCheckout(service: SupabaseClient, business: { id: string; legal_name: string; stripe_customer_id: string | null }, user: { id: string; email: string | null }, origin: string): Promise<{ checkoutUrl: string; purchaseId: string }> {
  const stripe = getStripeClient();
  const { productRowId, priceId, cents } = await ensureDfyPrice(stripe, service);
  let customerId = business.stripe_customer_id;
  if (!customerId) {
    const c = await stripe.customers.create({ email: user.email ?? undefined, name: business.legal_name, metadata: { business_id: business.id } });
    customerId = c.id; await service.from("businesses").update({ stripe_customer_id: customerId }).eq("id", business.id);
  }
  const { data: purchase, error } = await service.from("addon_purchases").insert({ business_id: business.id, addon_product_id: productRowId, purchase_type: "addon_one_time", quantity: 1, amount_cents: cents, status: "pending" }).select("id").single();
  if (error || !purchase) throw new Error(error?.message || "Could not start the purchase.");
  const session = await stripe.checkout.sessions.create({
    mode: "payment", customer: customerId, line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/dashboard/onboarding/dfy?purchase=success`, cancel_url: `${origin}/dashboard/onboarding/dfy?purchase=canceled`,
    metadata: { business_id: business.id, purchase_id: purchase.id, dfy: "1" },
  });
  await service.from("addon_purchases").update({ stripe_checkout_session_id: session.id }).eq("id", purchase.id);
  return { checkoutUrl: session.url!, purchaseId: purchase.id };
}

/** Webhook: the install was paid. Mark the onboarding choice and hand the account to the team instantly. Nothing resets. */
export async function onDfyPurchased(service: SupabaseClient, businessId: string, purchaseId: string): Promise<void> {
  const now = new Date().toISOString();
  const { data: biz } = await service.from("businesses").select("legal_name, owner_id").eq("id", businessId).single();
  const { data: owner } = biz ? await service.from("users").select("email, full_name").eq("id", biz.owner_id).maybeSingle() : { data: null };
  const { data: row } = await service.from("customer_onboarding").select("confirmed_steps, step_data").eq("business_id", businessId).maybeSingle();
  await service.from("customer_onboarding").upsert({ business_id: businessId, dfy_choice: "install", dfy_chosen_at: now, confirmed_steps: { ...((row?.confirmed_steps as Record<string, string>) ?? {}), "9": now }, step_data: { ...((row?.step_data as Record<string, unknown>) ?? {}), "9": { purchase_id: purchaseId, paid_at: now } }, updated_at: now }, { onConflict: "business_id" });
  const name = biz?.legal_name ?? "a customer";
  let taskId: string | null = null;
  try {
    const t = await createTask("hyperagent", { title: `DFY install purchased — start handoff: ${name}`.slice(0, 200), priority: "urgent", requires_review: true, context: `${name} paid the $${DFY_INSTALL_USD.toLocaleString()} done-for-you install (purchase ${purchaseId}). Owner: ${owner?.full_name ?? ""} ${owner?.email ?? ""}. Their onboarding state (profile, connections, ICP, lead list, sequence) is intact — pick up from the dashboard, do not reset anything. First 90 days are ours.` });
    taskId = t.id;
  } catch (e) { console.error("[dfy] handoff task failed:", e instanceof Error ? e.message : e); }
  await alertOwners(service, {
    trigger: "lead_new",
    sms: `DFY INSTALL PAID: ${name} ($${DFY_INSTALL_USD.toLocaleString()}). Handoff task created.`,
    email: { subject: `DFY install purchased — ${name}`, html: `<p><strong>${esc(name)}</strong> paid the $${DFY_INSTALL_USD.toLocaleString()} done-for-you install.</p><p>Owner: ${esc(owner?.full_name ?? "")} ${esc(owner?.email ?? "")}</p><p>Handoff task${taskId ? ` ${taskId}` : ""} is on the board. Their onboarding state is intact — pick up from the dashboard.</p>`, text: `${name} paid the $${DFY_INSTALL_USD} DFY install. Handoff task created.` },
    inApp: { type: "lead_new", title: `DFY install purchased: ${name}`, body: `$${DFY_INSTALL_USD.toLocaleString()} · handoff task created`, actionUrl: "/team/tasks", actionLabel: "Open tasks" },
    detail: { business_id: businessId, purchase_id: purchaseId, task_id: taskId },
  });
}
