import { test } from "node:test";
import assert from "node:assert/strict";
import { syncAgencySubscription, agencyEntitled, billingEnabled, PLATFORM_PRICE_CENTS } from "../../lib/agency/billing";

type Call = { table: string; op: string; arg?: unknown };
function fakeService(row: Record<string, unknown> | null) {
  const calls: Call[] = [];
  const chain = (table: string) => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row }) }) }),
    upsert: async (arg: unknown) => { calls.push({ table, op: "upsert", arg }); return { error: null }; },
  });
  return { svc: { from: (t: string) => chain(t) } as never, calls };
}
const sub = (metadata: Record<string, string>, over: Record<string, unknown> = {}) => ({ id: "sub_1", customer: "cus_1", status: "active", cancel_at_period_end: false, current_period_end: 1800000000, items: { data: [] }, metadata, ...over }) as never;

test("an SFB Agent subscription is NOT handled by the agency code (returns false, writes nothing)", async () => {
  const { svc, calls } = fakeService(null);
  assert.equal(await syncAgencySubscription(svc, sub({ kind: "agent_plan", plan_key: "solo" })), false);
  assert.equal(await syncAgencySubscription(svc, sub({})), false);
  assert.equal(calls.length, 0);
});
test("an agency platform subscription is recorded from our own metadata", async () => {
  const { svc, calls } = fakeService(null);
  assert.equal(await syncAgencySubscription(svc, sub({ kind: "agency_platform", agency_id: "a1" })), true);
  const w = calls[0].arg as Record<string, unknown>; assert.equal(w.agency_id, "a1"); assert.equal(w.subscription_status, "active"); assert.equal(w.stripe_customer_id, "cus_1");
});
test("a subscription whose customer doesn't match the stored one is refused (handled, nothing written)", async () => {
  const { svc, calls } = fakeService({ stripe_customer_id: "cus_OTHER" });
  assert.equal(await syncAgencySubscription(svc, sub({ kind: "agency_platform", agency_id: "a1" })), true); assert.equal(calls.length, 0);
});
test("entitlement: everyone with billing off; only active/trialing with it on; price is $49", async () => {
  const prev = process.env.AGENCY_BILLING_ENABLED;
  try {
    delete process.env.AGENCY_BILLING_ENABLED; assert.equal(billingEnabled(), false); assert.equal(await agencyEntitled(fakeService(null).svc, "a"), true);
    process.env.AGENCY_BILLING_ENABLED = "1"; assert.equal(billingEnabled(), true);
    assert.equal(await agencyEntitled(fakeService(null).svc, "a"), false);
    for (const [s, ok] of [["active", true], ["trialing", true], ["past_due", false], ["canceled", false], ["unpaid", false]] as const) assert.equal(await agencyEntitled(fakeService({ subscription_status: s }).svc, "a"), ok, s);
  } finally { if (prev === undefined) delete process.env.AGENCY_BILLING_ENABLED; else process.env.AGENCY_BILLING_ENABLED = prev; }
  assert.equal(PLATFORM_PRICE_CENTS, 4900);
});
