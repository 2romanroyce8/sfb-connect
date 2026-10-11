import { test } from "node:test";
import assert from "node:assert/strict";
import { trialExpiry, parseTrialSetup, TRIAL_PRICE_CENTS } from "../../lib/agentProgram/trial";
import { trialLookupKey } from "../../lib/agentProgram/stripe";
import { TRIAL_TIER, TRIAL_IS_FREE, STOCK_PROFILES } from "../../lib/agentProgram/config";

test("5-day trial: free (no Stripe path at signup), expiry counts from provisioning; the paid path stays config-switchable", () => {
  assert.equal(TRIAL_IS_FREE, true); assert.equal(TRIAL_PRICE_CENTS, 0);
  assert.equal(trialLookupKey(), "sfb_agent_trial_5day");
  const paid = new Date("2026-10-11T16:00:00Z");
  assert.equal(trialExpiry(paid).toISOString(), "2026-10-16T16:00:00.000Z");
  assert.equal(TRIAL_TIER.trialDays, 5);
});

test("trial setup validation: exactly 3 capabilities, a real stock profile, a name; scan domain sanitized", () => {
  const ok = parseTrialSetup({ name: "Roman", stockProfile: STOCK_PROFILES[0].key, capabilities: ["ai_presence", "outbound_gtm", "reviews_reputation"], scanDomain: "Example.com" });
  assert.ok("setup" in ok); if ("setup" in ok) { assert.equal(ok.setup.scan_domain, "example.com"); assert.equal(ok.setup.capabilities.length, 3); }
  assert.deepEqual(parseTrialSetup({ name: "R", stockProfile: STOCK_PROFILES[0].key, capabilities: ["ai_presence", "outbound_gtm", "reviews_reputation"] }), { error: "Enter your name." });
  assert.deepEqual(parseTrialSetup({ name: "Roman", stockProfile: "nope", capabilities: ["ai_presence", "outbound_gtm", "reviews_reputation"] }), { error: "Pick a sample business." });
  assert.match((parseTrialSetup({ name: "Roman", stockProfile: STOCK_PROFILES[0].key, capabilities: ["ai_presence", "bogus"] }) as { error: string }).error, /exactly 3/);
  const noScan = parseTrialSetup({ name: "Roman", stockProfile: STOCK_PROFILES[0].key, capabilities: ["ai_presence", "outbound_gtm", "reviews_reputation"], scanDomain: "javascript:alert(1)" });
  if ("setup" in noScan) assert.equal(noScan.setup.scan_domain, null);
});
