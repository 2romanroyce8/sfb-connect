import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAccountInput, stageFor } from "../../lib/funnel/signup";
import { TIERS, PAID_TIERS } from "../../lib/agentProgram/config";
import { AGENT_PLAN_KEYS } from "../../lib/team/plans";

test("gated funnel: stage is derived from real state and cannot skip ahead", () => {
  assert.equal(stageFor(null, false), "account");
  assert.equal(stageFor({ email_verified_at: null, profile: null }, false), "verify");
  assert.equal(stageFor({ email_verified_at: "2026-10-12T00:00:00Z", profile: null }, false), "build");
  assert.equal(stageFor({ email_verified_at: "2026-10-12T00:00:00Z", profile: { businessName: "x" } as never }, false), "pricing");
  assert.equal(stageFor(null, true), "done", "a business with a plan always wins");
});

test("account step: name, work email, phone, website, password are all required; website normalized", () => {
  const ok = parseAccountInput({ name: "Roman Royce", email: "Roman@Example.com", phone: "(405) 223-7699", website: "LimitlessRoofingOKC.com/", password: "longenough1" });
  assert.ok(!("error" in ok)); if (!("error" in ok)) { assert.equal(ok.email, "roman@example.com"); assert.equal(ok.domain, "limitlessroofingokc.com"); assert.equal(ok.website, "https://limitlessroofingokc.com"); }
  assert.deepEqual(parseAccountInput({ name: "R", email: "a@b.co", phone: "4052237699", website: "x.com", password: "longenough1" }), { error: "Enter your name." });
  assert.deepEqual(parseAccountInput({ name: "Roman", email: "a@b.co", phone: "123", website: "x.com", password: "longenough1" }), { error: "Enter a phone number with at least 10 digits." });
  assert.deepEqual(parseAccountInput({ name: "Roman", email: "a@b.co", phone: "4052237699", website: "not a site", password: "longenough1" }), { error: "Enter your business website." });
  assert.deepEqual(parseAccountInput({ name: "Roman", email: "a@b.co", phone: "4052237699", website: "x.com", password: "short" }), { error: "Create a password of at least 8 characters." });
});

test("no trial tier exists anywhere in config (removed 2026-10-12)", () => {
  assert.deepEqual(TIERS.map((t) => t.key), ["solo", "agency"]);
  assert.equal(PAID_TIERS.length, 2);
  assert.deepEqual([...AGENT_PLAN_KEYS], ["solo", "agency"]);
  for (const t of TIERS) assert.ok(t.monthlyUsd > 0 && !("trialDays" in t));
});
