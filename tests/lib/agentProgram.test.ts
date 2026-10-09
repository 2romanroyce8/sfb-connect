import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_MODULES, roadmapPosition, sortModules } from "../../lib/agentProgram/modules";
import { AGENT_PLANS, CREDIT_TIERS } from "../../lib/agentProgram/config";

test("six modules, AI Presence is the only live one by default, chat is next", () => {
  assert.equal(DEFAULT_MODULES.length, 6);
  assert.deepEqual(DEFAULT_MODULES.filter((m) => m.status === "live").map((m) => m.key), ["ai_presence"]);
  assert.equal(roadmapPosition(DEFAULT_MODULES, "chat_agent"), 1);
  assert.equal(roadmapPosition(DEFAULT_MODULES, "sops"), 5);
  assert.equal(roadmapPosition(DEFAULT_MODULES, "ai_presence"), null, "live modules have no roadmap position");
});

test("roadmap position follows database order and skips live modules", () => {
  const mods = sortModules(DEFAULT_MODULES.map((m) => (m.key === "chat_agent" ? { ...m, status: "live" as const } : m)));
  assert.equal(roadmapPosition(mods, "crm_automations"), 1);
  assert.equal(roadmapPosition(mods, "website"), 2);
});

test("pricing and credit tiers match the published offer", () => {
  assert.deepEqual(AGENT_PLANS.map((p) => p.monthlyUsd), [1497, 2997, 4997]);
  assert.deepEqual(AGENT_PLANS.map((p) => p.creditsPerMonth), [50, 150, 400]);
  assert.deepEqual(CREDIT_TIERS.map((t) => t.credits), [1, 5, 25]);
});

import { AGENT_PLAN_KEYS, SFB_PLAN_PRICES, SFB_PLAN_LABELS, isAgentPlanKey } from "../../lib/team/plans";
import { agentPlan } from "../../lib/agentProgram/config";
import { monthlyLookupKey, onboardingLookupKey } from "../../lib/agentProgram/stripe";

test("agent plan keys are first-class plans with matching prices and labels", () => {
  for (const k of AGENT_PLAN_KEYS) {
    const p = agentPlan(k)!;
    assert.ok(p, k);
    assert.equal(SFB_PLAN_PRICES[k], p.monthlyUsd, `${k} monthly price must match config`);
    assert.match(SFB_PLAN_LABELS[k], /^SFB Agent — /);
    assert.equal(isAgentPlanKey(k), true);
  }
  assert.equal(isAgentPlanKey("revenue_growth"), false);
});

test("stripe lookup keys are stable and distinct per tier and kind", () => {
  const keys = AGENT_PLAN_KEYS.flatMap((k) => { const p = agentPlan(k)!; return [monthlyLookupKey(p), onboardingLookupKey(p)]; });
  assert.equal(new Set(keys).size, 6);
  assert.equal(monthlyLookupKey(agentPlan("agent_growth")!), "sfb_agent_growth_monthly");
});
