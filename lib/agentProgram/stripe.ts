import type Stripe from "stripe";
import { PAID_TIERS, TOP_UP_PACKS, type Tier } from "./config";

// Stripe catalog addressed by lookup_key -- no hard-coded price ids, no env
// vars. First use creates product + prices; later uses find them. Amounts
// come from config, never from the client.
export const monthlyLookupKey = (t: Tier) => `sfb_agent_${t.key}_monthly`;
export const onboardingLookupKey = (t: Tier) => `sfb_agent_${t.key}_onboarding`;
export const topUpLookupKey = (credits: number) => `sfb_topup_${credits}`;

async function findPrices(stripe: Stripe, keys: string[]) {
  const r = await stripe.prices.list({ lookup_keys: keys, active: true, limit: 10 });
  return new Map(r.data.map((p) => [p.lookup_key, p]));
}

export async function ensureTierPrices(stripe: Stripe, t: Tier): Promise<{ monthlyPriceId: string; onboardingPriceId: string }> {
  if (t.monthlyUsd === 0) throw new Error("The trial has no Stripe prices.");
  const keys = [monthlyLookupKey(t), onboardingLookupKey(t)];
  const found = await findPrices(stripe, keys);
  let monthly = found.get(keys[0]); let onboarding = found.get(keys[1]);
  if (monthly && onboarding) return { monthlyPriceId: monthly.id, onboardingPriceId: onboarding.id };
  const productId = (monthly?.product ?? onboarding?.product) as string | undefined;
  const product = productId ? await stripe.products.retrieve(productId) : await stripe.products.create({ name: `SFB Agent — ${t.name}`, description: `${t.creditsLabel} credits · ${t.overseer} human overseer · all 8 capabilities`, metadata: { plan_key: t.key } });
  if (!monthly) monthly = await stripe.prices.create({ product: product.id, currency: "usd", unit_amount: t.monthlyUsd * 100, recurring: { interval: "month" }, lookup_key: keys[0], nickname: `${t.name} monthly`, metadata: { plan_key: t.key, kind: "monthly" } });
  if (!onboarding) onboarding = await stripe.prices.create({ product: product.id, currency: "usd", unit_amount: t.onboardingUsd * 100, lookup_key: keys[1], nickname: `${t.name} onboarding (one-time)`, metadata: { plan_key: t.key, kind: "onboarding" } });
  return { monthlyPriceId: monthly.id, onboardingPriceId: onboarding.id };
}

export async function ensureTopUpPrice(stripe: Stripe, credits: number): Promise<string> {
  const pack = TOP_UP_PACKS.find((p) => p.credits === credits);
  if (!pack) throw new Error(`No top-up pack of ${credits} credits.`);
  const key = topUpLookupKey(credits);
  const found = await findPrices(stripe, [key]);
  const existing = found.get(key);
  if (existing) return existing.id;
  const product = await stripe.products.create({ name: `SFB Agent credits — ${pack.name}`, metadata: { kind: "topup", credits: String(credits) } });
  const price = await stripe.prices.create({ product: product.id, currency: "usd", unit_amount: pack.usd * 100, lookup_key: key, nickname: pack.name, metadata: { kind: "topup", credits: String(credits) } });
  return price.id;
}

export const paidTiers = () => PAID_TIERS;
