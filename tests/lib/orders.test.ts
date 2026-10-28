import { test } from "node:test";
import assert from "node:assert/strict";
import { canMove, gateFor, margin, usd, toCents, FORWARD, STATUSES } from "../../lib/agency/orders";

test("status path: one step forward or back, cancel from anywhere open, no jumping, canceled is final", () => {
  for (let i = 0; i < FORWARD.length - 1; i++) { assert.equal(canMove(FORWARD[i], FORWARD[i + 1]).ok, true, FORWARD[i]); assert.equal(canMove(FORWARD[i + 1], FORWARD[i]).ok, true); }
  assert.equal(canMove("draft", "live").ok, false); assert.equal(canMove("quoted", "qa").ok, false);
  for (const s of FORWARD) assert.equal(canMove(s, "canceled").ok, true, s);
  assert.equal(canMove("canceled", "draft").ok, false); assert.equal(canMove("live", "live").ok, false); assert.equal(canMove("draft", "bogus").ok, false);
  assert.equal(STATUSES.length, 10);
});
test("gates: a quote needs a price; work and launch need approved onboarding", () => {
  const none = { price_setup_cents: 0, price_monthly_cents: 0 }, priced = { price_setup_cents: 50000, price_monthly_cents: 0 };
  assert.ok(gateFor("quoted", none, true)); assert.equal(gateFor("quoted", priced, false), null);
  for (const s of ["in_development", "qa", "client_review", "live"]) { assert.ok(gateFor(s, priced, false), s); assert.equal(gateFor(s, priced, true), null, s); }
  assert.equal(gateFor("onboarding", priced, false), null); assert.equal(gateFor("canceled", none, false), null);
});
test("margin is computed from the agency's own numbers; no retail price gives null, not 0%", () => {
  const m = margin({ cost_setup_cents: 10000, price_setup_cents: 25000, cost_monthly_cents: 2000, price_monthly_cents: 8000 });
  assert.equal(m.setup.profit, 15000); assert.equal(Math.round(m.setup.pct!), 60); assert.equal(m.monthly.profit, 6000); assert.equal(Math.round(m.monthly.pct!), 75); assert.equal(m.yearlyRecurringProfit, 72000);
  assert.equal(margin({ cost_setup_cents: 500, price_setup_cents: 0, cost_monthly_cents: 0, price_monthly_cents: 0 }).setup.pct, null);
  assert.equal(margin({ cost_setup_cents: 900, price_setup_cents: 500, cost_monthly_cents: 0, cost_monthly_cents2: 0 } as never).setup.profit, -400);
});
test("money formatting and parsing", () => {
  assert.equal(usd(25000), "$250"); assert.equal(usd(1234), "$12.34"); assert.equal(usd(-400), "-$4");
  assert.equal(toCents("$1,250.50"), 125050); assert.equal(toCents(45), 4500); assert.equal(toCents(""), null); assert.equal(toCents("abc"), null); assert.equal(toCents(-5), null); assert.equal(toCents(99999999), null);
});
