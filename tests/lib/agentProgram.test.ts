import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_MODULES, roadmapPosition, sortModules } from "../../lib/agentProgram/modules";
import { CAPABILITIES, CAPABILITY_KEYS, TIERS, CREDIT_PRICES, TOP_UP_PACKS, bookedCallsFor, tier, creditPrice, STOCK_PROFILES } from "../../lib/agentProgram/config";
import { AGENT_PLAN_KEYS, SFB_PLAN_PRICES, isAgentPlanKey } from "../../lib/team/plans";
import { monthlyLookupKey, onboardingLookupKey, topUpLookupKey } from "../../lib/agentProgram/stripe";
import { creditState } from "../../lib/billing/guards";

test("eight capabilities, unique keys, all priced", () => {
  assert.equal(CAPABILITIES.length, 8);
  assert.equal(new Set(CAPABILITY_KEYS).size, 8);
  for (const k of CAPABILITY_KEYS) assert.ok(CREDIT_PRICES.some((p) => p.capability === k), `${k} has no priced actions`);
  assert.equal(new Set(CREDIT_PRICES.map((p) => p.key)).size, CREDIT_PRICES.length);
});

test("tiers match the published table", () => {
  assert.deepEqual(TIERS.map((t) => [t.key, t.monthlyUsd, t.credits, t.onboardingUsd, t.capabilityLimit, t.businesses]), [["trial", 0, 128, 0, 3, 1], ["solo", 1497, 150, 1497, 8, 1], ["agency", 4997, 500, 4997, 8, 5]]);
  assert.equal(tier("trial")!.priceListVisible, false);
  assert.deepEqual(AGENT_PLAN_KEYS, ["trial", "solo", "agency"]);
  for (const t of TIERS) { assert.equal(SFB_PLAN_PRICES[t.key], t.monthlyUsd); assert.ok(isAgentPlanKey(t.key)); }
});

test("planning math: 15 credits per booked call -> trial 8, solo 10, agency 33", () => {
  assert.deepEqual(TIERS.map((t) => bookedCallsFor(t.credits)), [8, 10, 33]);
});

test("spot-check published prices and top-ups", () => {
  assert.equal(creditPrice("outbound.meeting_booked")!.credits, 5);
  assert.equal(creditPrice("website.full_build")!.credits, 100);
  assert.equal(creditPrice("human.review_pass")!.credits, 5);
  assert.deepEqual(TOP_UP_PACKS.map((p) => [p.credits, p.usd]), [[100, 149], [500, 599], [1000, 999]]);
});

test("stripe lookup keys are stable and distinct", () => {
  const keys = [...TIERS.filter((t) => t.monthlyUsd > 0).flatMap((t) => [monthlyLookupKey(t), onboardingLookupKey(t)]), ...TOP_UP_PACKS.map((p) => topUpLookupKey(p.credits))];
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(monthlyLookupKey(tier("solo")!), "sfb_agent_solo_monthly");
});

test("credit guards: 80% warn, 95% critical, zero empty, never negative", () => {
  assert.equal(creditState(150, 150).level, "ok");
  assert.equal(creditState(30, 150).level, "warn");
  assert.equal(creditState(7, 150).level, "critical");
  assert.equal(creditState(0, 150).level, "empty");
  assert.equal(creditState(-5, 150).level, "empty");
});

test("stock profiles have city and state; roadmap position skips live", () => {
  for (const p of STOCK_PROFILES) { assert.ok(p.city && p.state); }
  assert.equal(roadmapPosition(sortModules(DEFAULT_MODULES), "ai_presence"), null);
});
