import { test } from "node:test";
import assert from "node:assert/strict";
import { CREDIT_PRICES, TIERS, TOP_UP_PACKS, CREDITS_PER_BOOKED_CALL, FREE_ACTIONS, WARN_AT, bookedCallsFor } from "../../lib/agentProgram/config";
import { splitBalance, creditState } from "../../lib/billing/guards";

// Roman's token economy spec (2026-10-10) — exact values. If this fails, the
// pricing page, dashboard and ledger all drift together, which is the P0.
const EXPECTED: Record<string, number> = {
  "presence.listing_fix": 1, "presence.score_refresh": 2, "presence.content_brief": 5, "presence.competitor_analysis": 10, "presence.market_analysis": 15,
  "outbound.prospect_sourced": 1, "outbound.prospect_enriched": 2, "outbound.message_written": 2, "outbound.reply_drafted": 2, "outbound.meeting_booked": 5, "outbound.sequence_built": 15,
  "ads.creative": 5, "ads.audience": 5, "ads.optimization_pass": 10, "ads.campaign_launch": 25,
  "website.tweak": 5, "website.landing_page": 15, "website.full_build": 100,
  "backend.automation": 10, "backend.pipeline_setup": 25, "backend.qa_pass": 5,
  "chat.turn": 1, "chat.booking": 3, "chat.handoff": 2,
  "reviews.request": 1, "reviews.response": 2, "reviews.sentiment_report": 5,
  "sops.update": 5, "sops.library_doc": 25,
  "human.review_pass": 5,
};

test("every per-action price matches the spec exactly", () => {
  for (const [key, credits] of Object.entries(EXPECTED)) {
    const p = CREDIT_PRICES.find((x) => x.key === key);
    assert.ok(p, `missing action ${key}`);
    assert.equal(p!.credits, credits, `${key} should cost ${credits}`);
  }
  assert.ok(CREDIT_PRICES.every((p) => Number.isInteger(p.credits) && p.credits >= 0), "no fractional or negative prices");
  assert.deepEqual([...FREE_ACTIONS], ["Sends", "Report views", "Logins", "Capability toggles"]);
});

test("tiers, top-ups and planning math match the spec", () => {
  const t = (k: string) => TIERS.find((x) => x.key === k)!;
  assert.equal(t("trial").credits, 128); assert.equal(t("solo").credits, 150); assert.equal(t("agency").credits, 500);
  assert.deepEqual(TOP_UP_PACKS.map((p) => [p.credits, p.usd]), [[100, 149], [500, 599], [1000, 999]]);
  assert.equal(CREDITS_PER_BOOKED_CALL, 15); assert.equal(bookedCallsFor(150), 10); assert.equal(bookedCallsFor(500), 33);
  assert.equal(WARN_AT, 0.8);
});

test("monthly allotment spends first; top-ups are what's left", () => {
  // 150 allotment, 40 top-up, spent 18 this cycle → 132 / 150 + 40 top-up
  assert.deepEqual(splitBalance(172, 150, 18), { monthlySpent: 18, monthlyRemaining: 132, topupBalance: 40 });
  // allotment exhausted → everything left is top-up
  assert.deepEqual(splitBalance(40, 150, 150), { monthlySpent: 150, monthlyRemaining: 0, topupBalance: 40 });
  // over-spent beyond allotment eats into top-ups; never negative
  assert.deepEqual(splitBalance(25, 150, 165), { monthlySpent: 150, monthlyRemaining: 0, topupBalance: 25 });
  assert.deepEqual(splitBalance(0, 150, 150), { monthlySpent: 150, monthlyRemaining: 0, topupBalance: 0 });
});

test("guards: amber at 80%, red at 95%, empty at zero", () => {
  assert.equal(creditState(150, 150).level, "ok");
  assert.equal(creditState(30, 150).level, "warn");
  assert.equal(creditState(7, 150).level, "critical");
  assert.equal(creditState(0, 150).level, "empty");
});
