import type Stripe from "stripe";
import { PAID_TIERS, TOP_UP_PACKS, TRIAL_TIER, annualUsd, type BillingInterval, type Tier } from "./config";

// Stripe catalog addressed by lookup_key -- no hard-coded price ids, no env
// vars. First use creates product + prices; later uses find them. Amounts
// come from config, never from the client.
export const monthlyLookupKey = (t: Tier) => `sfb_agent_${t.key}_monthly`;
export const annualLookupKey = (t: Tier) => `sfb_agent_${t.key}_annual`;
export const onboardingLookupKey = (t: Tier) => `sfb_agent_${t.key}_onboarding`;
export const topUpLookupKey = (credits: number) => `sfb_topup_${credits}`;
/** The $1 / 5-day trial: one-time price. Days are in the key so a future change to the length creates a new price instead of silently re-using this one. */
export const trialLookupKey = () => `sfb_agent_trial_${TRIAL_TIER.trialDays}day`;

async function findPrices(stripe: Stripe, keys: string[]) {
  const r = await stripe.prices.list({ lookup_keys: keys, active: true, limit: 10 });
  return new Map(r.data.map((p) => [p.lookup_key, p]));
}

/** The recurring price for the chosen interval plus the one-time onboarding price (same on both intervals — setup is never discounted). */
export async function ensureTierPrices(stripe: Stripe, t: Tier, interval: BillingInterval = "month"): Promise<{ recurringPriceId: string; onboardingPriceId: string }> {
  if (t.monthlyUsd === 0) throw new Error("The trial has no Stripe prices.");
  const recurringKey = interval === "year" ? annualLookupKey(t) : monthlyLookupKey(t);
  const keys = [recurringKey, onboardingLookupKey(t)];
  const found = await findPrices(stripe, keys);
  let recurring = found.get(keys[0]); let onboarding = found.get(keys[1]);
  if (recurring && onboarding) return { recurringPriceId: recurring.id, onboardingPriceId: onboarding.id };
  // Reuse the tier's product if any of its prices already exist (monthly may exist when annual is first requested).
  const sibling = recurring ?? onboarding ?? (await findPrices(stripe, [monthlyLookupKey(t), annualLookupKey(t)])).values().next().value;
  const productId = sibling?.product as string | undefined;
  const product = productId ? await stripe.products.retrieve(productId) : await stripe.products.create({ name: `SFB Agent — ${t.name}`, description: `${t.creditsLabel} credits · ${t.overseer} human overseer · all 8 capabilities`, metadata: { plan_key: t.key } });
  if (!recurring) {
    recurring = interval === "year"
      ? await stripe.prices.create({ product: product.id, currency: "usd", unit_amount: annualUsd(t.monthlyUsd) * 100, recurring: { interval: "year" }, lookup_key: recurringKey, nickname: `${t.name} annual`, metadata: { plan_key: t.key, kind: "annual" } })
      : await stripe.prices.create({ product: product.id, currency: "usd", unit_amount: t.monthlyUsd * 100, recurring: { interval: "month" }, lookup_key: recurringKey, nickname: `${t.name} monthly`, metadata: { plan_key: t.key, kind: "monthly" } });
  }
  if (!onboarding) onboarding = await stripe.prices.create({ product: product.id, currency: "usd", unit_amount: t.onboardingUsd * 100, lookup_key: keys[1], nickname: `${t.name} onboarding (one-time)`, metadata: { plan_key: t.key, kind: "onboarding" } });
  return { recurringPriceId: recurring.id, onboardingPriceId: onboarding.id };
}

/** One-time trial price from config. Found by lookup key; created on first use. */
export async function ensureTrialPrice(stripe: Stripe): Promise<string> {
  const key = trialLookupKey();
  const existing = (await findPrices(stripe, [key])).get(key);
  if (existing) {
    if (existing.unit_amount !== TRIAL_TIER.trialUsd * 100 || existing.recurring) throw new Error(`Stripe price ${key} does not match config (${TRIAL_TIER.trialUsd} USD one-time). Archive it in Stripe and retry.`);
    return existing.id;
  }
  const product = await stripe.products.create({ name: `SFB Agent — ${TRIAL_TIER.trialDays}-day trial`, description: `${TRIAL_TIER.credits} credits on a demo business · ${TRIAL_TIER.capabilityLimit} capabilities to watch · ${TRIAL_TIER.trialDays} days of access · sandbox, no real sends`, metadata: { plan_key: "trial", kind: "trial" } });
  const price = await stripe.prices.create({ product: product.id, currency: "usd", unit_amount: TRIAL_TIER.trialUsd * 100, lookup_key: key, nickname: `Trial (${TRIAL_TIER.trialDays} days, one-time)`, metadata: { plan_key: "trial", kind: "trial", days: String(TRIAL_TIER.trialDays) } });
  return price.id;
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
