import type Stripe from "stripe";
import { AGENT_PLANS, type AgentPlan } from "./config";

// Stripe catalog for the SFB Agent tiers, addressed by lookup_key so the
// code never depends on hard-coded price ids or env vars. Idempotent: the
// first checkout for a tier creates its product + two prices; every later
// one finds them. Amounts come from config -- never from the client.
export const monthlyLookupKey = (plan: AgentPlan) => `sfb_${plan.key}_monthly`;
export const onboardingLookupKey = (plan: AgentPlan) => `sfb_${plan.key}_onboarding`;

export async function ensureAgentPrices(stripe: Stripe, plan: AgentPlan): Promise<{ monthlyPriceId: string; onboardingPriceId: string }> {
  const keys = [monthlyLookupKey(plan), onboardingLookupKey(plan)];
  const existing = await stripe.prices.list({ lookup_keys: keys, active: true, limit: 10 });
  const byKey = new Map(existing.data.map((p) => [p.lookup_key, p]));
  let monthly = byKey.get(keys[0]);
  let onboarding = byKey.get(keys[1]);
  if (monthly && onboarding) return { monthlyPriceId: monthly.id, onboardingPriceId: onboarding.id };

  const productId = (monthly?.product ?? onboarding?.product) as string | undefined;
  const product = productId
    ? await stripe.products.retrieve(productId)
    : await stripe.products.create({ name: `SFB Agent — ${plan.name}`, description: `${plan.creditsPerMonth} credits/month · ${plan.overseer} human overseer · all six modules as they ship`, metadata: { plan_key: plan.key } });

  if (!monthly) monthly = await stripe.prices.create({ product: product.id, currency: "usd", unit_amount: plan.monthlyUsd * 100, recurring: { interval: "month" }, lookup_key: keys[0], nickname: `${plan.name} monthly`, metadata: { plan_key: plan.key, kind: "monthly" } });
  if (!onboarding) onboarding = await stripe.prices.create({ product: product.id, currency: "usd", unit_amount: plan.onboardingUsd * 100, lookup_key: keys[1], nickname: `${plan.name} onboarding (one-time)`, metadata: { plan_key: plan.key, kind: "onboarding" } });
  return { monthlyPriceId: monthly.id, onboardingPriceId: onboarding.id };
}

export const allAgentPlans = () => AGENT_PLANS;
