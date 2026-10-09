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
