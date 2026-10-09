// Single source of truth for what each SFB Connect plan is worth. Every
// revenue-producing code path (the Won pipeline stage, revenue analytics,
// any future billing integration) must import this rather than hardcoding
// its own price map -- that's what "never trust a client-supplied dollar
// amount" actually means in practice.
export const SFB_PLAN_PRICES = {
  revenue_presence: 19.99,
  revenue_growth: 197,
  revenue_dominance: 359,
  // SFB Agent tiers (monthly; onboarding fee is a separate one-time charge, see lib/agentProgram/config.ts)
  trial: 0,
  solo: 1497,
  agency: 4997,
} as const;

export type PlanKey = keyof typeof SFB_PLAN_PRICES;

export const SFB_PLAN_LABELS: Record<PlanKey, string> = {
  revenue_presence: "Revenue Presence",
  revenue_growth: "Revenue Growth",
  revenue_dominance: "Revenue Dominance",
  trial: "SFB Agent — Trial",
  solo: "SFB Agent — Solo",
  agency: "SFB Agent — Agency",
};

export const AGENT_PLAN_KEYS = ["trial", "solo", "agency"] as const;
export type AgentPlanKey = (typeof AGENT_PLAN_KEYS)[number];
export function isAgentPlanKey(value: unknown): value is AgentPlanKey {
  return typeof value === "string" && (AGENT_PLAN_KEYS as readonly string[]).includes(value);
}

export function isPlanKey(value: unknown): value is PlanKey {
  return typeof value === "string" && value in SFB_PLAN_PRICES;
}
