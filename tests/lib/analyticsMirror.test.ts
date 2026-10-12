import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { aggregateStripe } from "../../lib/team/analytics/stripeMirror";
import { computeMrr } from "../../lib/team/analytics/company";

const day = (n: number) => Math.floor((Date.UTC(2026, 9, 1) + n * 86400e3) / 1000);

test("Stripe mirror is read-only by construction: no mutating Stripe calls in the module", () => {
  const src = readFileSync(new URL("../../lib/team/analytics/stripeMirror.ts", import.meta.url), "utf8");
  for (const bad of [".create(", ".update(", ".del(", ".cancel(", ".capture(", ".refund(", "refunds.create", "charges.create", "paymentIntents", "customers.update", "subscriptions.update", "payouts.create"]) assert.ok(!src.includes(bad), `mutating call "${bad}" found in stripeMirror.ts`);
  assert.ok(src.includes(".list(") && src.includes("balance.retrieve()"), "reads only via list/retrieve");
});

test("aggregateStripe: gross = succeeded charges, failed counted separately, refunds net out, subscriptions → MRR, payouts split paid/in transit", () => {
  const start = new Date(Date.UTC(2026, 9, 1)); const end = new Date(Date.UTC(2026, 9, 7, 23, 59));
  const m = aggregateStripe({
    range: "7d", rangeStart: start, rangeEnd: end, currency: "usd", livemode: true,
    charges: [{ amount: 149700, amount_refunded: 0, status: "succeeded", created: day(1), currency: "usd" }, { amount: 14900, amount_refunded: 14900, status: "succeeded", created: day(2), currency: "usd" }, { amount: 499700, amount_refunded: 0, status: "failed", created: day(3), currency: "usd" }],
    refunds: [{ amount: 14900, created: day(2), status: "succeeded" }, { amount: 999, created: day(2), status: "failed" }],
    disputes: [{ amount: 14900, created: day(4), status: "needs_response" }],
    customers: [{ created: day(1) }, { created: day(5) }],
    subscriptions: [{ status: "active", items: [{ unit_amount: 149700, quantity: 1, interval: "month", interval_count: 1 }] }, { status: "active", items: [{ unit_amount: 1497000, quantity: 1, interval: "year", interval_count: 1 }] }, { status: "past_due", items: [{ unit_amount: 499700, quantity: 1, interval: "month", interval_count: 1 }] }],
    payouts: [{ amount: 100000, created: day(3), arrival_date: day(5), status: "paid" }, { amount: 50000, created: day(6), arrival_date: day(8), status: "in_transit" }],
    balance: { available: 123456, pending: 7890 },
  });
  assert.equal(m.grossVolume, 1646); assert.equal(m.succeededCount, 2); assert.equal(m.failedCount, 1); assert.equal(m.failedAmount, 4997);
  assert.equal(m.refundsAmount, 149, "failed refunds don't count"); assert.equal(m.netVolume, 1497);
  assert.equal(m.disputesCount, 1); assert.equal(m.disputesOpen, 1); assert.equal(m.newCustomers, 2);
  assert.equal(m.activeSubscriptions, 2); assert.equal(m.pastDueSubscriptions, 1); assert.equal(m.subscriptionMrr, 1497 + 1247.5, "annual plan counted at its per-month equivalent");
  assert.equal(m.payoutsPaid, 1000); assert.equal(m.payoutsInTransit, 500); assert.equal(m.balanceAvailable, 1234.56); assert.equal(m.balancePending, 78.9);
  assert.equal(m.granularity, "day"); assert.equal(m.timeline.length, 7); assert.equal(m.timeline.reduce((s, t) => s + t.gross, 0), 1646);
});

test("computeMrr: active plans × monthly price; annual orders at the per-month equivalent; unknown plan keys contribute 0", () => {
  const biz = [{ id: "a", plan_key: "solo" }, { id: "b", plan_key: "agency" }, { id: "c", plan_key: "solo" }, { id: "d", plan_key: "mystery" }];
  const r = computeMrr(biz, new Map([["c", "year"]]), (b) => b.id);
  assert.equal(r.total, 1497 + 4997 + 1247.5); assert.equal(r.byPlan.solo, 1497 + 1247.5); assert.equal(r.byPlan.agency, 4997); assert.equal(r.byPlan.mystery, 0);
});
