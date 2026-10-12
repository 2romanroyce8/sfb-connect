import { test } from "node:test";
import assert from "node:assert/strict";
import { planLaunch, summarizeLaunch, perProspectCredits, PRICES, LAUNCH_BATCH } from "../../lib/onboarding/campaign";
import { DFY_INSTALL_USD, DFY_LOOKUP_KEY, DFY_OFFER_LINE } from "../../lib/billing/dfyConstants";

test("prices come from the single source of truth (enrich 2, write 2, review 5)", () => {
  assert.equal(PRICES.enrich, 2); assert.equal(PRICES.write, 2); assert.equal(PRICES.review, 5); assert.equal(perProspectCredits(), 4);
});

test("launch plan: capped by batch, by prospects, and by what the balance affords; zero balance → top-up prompt, never negative", () => {
  assert.deepEqual(planLaunch(25, 150), { count: LAUNCH_BATCH, estimatedCredits: 40, topUp: false, reason: null });
  assert.deepEqual(planLaunch(3, 150), { count: 3, estimatedCredits: 12, topUp: false, reason: null });
  assert.deepEqual(planLaunch(25, 9), { count: 2, estimatedCredits: 8, topUp: false, reason: null }, "9 credits → 2 prospects, 1 left over");
  assert.deepEqual(planLaunch(25, 0), { count: 0, estimatedCredits: 0, topUp: true, reason: "out_of_credits" });
  assert.deepEqual(planLaunch(25, 3), { count: 0, estimatedCredits: 0, topUp: true, reason: "insufficient_for_one" });
  assert.deepEqual(planLaunch(0, 150), { count: 0, estimatedCredits: 0, topUp: false, reason: "no_prospects" });
  assert.deepEqual(planLaunch(2, 150, 10, 2), { count: 2, estimatedCredits: 4, topUp: false, reason: null }, "uploaded leads with emails skip the site read: 2 credits each");
  assert.deepEqual(planLaunch(5, 150, 10, 2), { count: 5, estimatedCredits: 16, topUp: false, reason: null }, "2 emailed (2 each) + 3 to enrich (4 each)");
  assert.deepEqual(planLaunch(5, 5, 10, 2), { count: 2, estimatedCredits: 4, topUp: false, reason: null }, "balance affords the two cheap ones, not a third at 4");
});

test("launch summary buckets outcomes", () => {
  const s = summarizeLaunch([{ prospectId: "a", name: "A", outcome: "drafted" }, { prospectId: "b", name: "B", outcome: "no_email" }, { prospectId: "c", name: "C", outcome: "no_website" }, { prospectId: "d", name: "D", outcome: "paused" }]);
  assert.deepEqual(s, { drafted: 1, noEmail: 2, paused: 1, errors: 0, total: 4 });
});

test("DFY: the only hard-coded dollar figure is Rome's $8,000; retainer has no price", () => {
  assert.equal(DFY_INSTALL_USD, 8000); assert.equal(DFY_LOOKUP_KEY, "sfb_dfy_install_8000"); assert.match(DFY_OFFER_LINE, /\$8,000 one-time install — setup plus first 90 days/);
});
