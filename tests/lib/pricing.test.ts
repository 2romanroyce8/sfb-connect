import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TIERS, TOP_UP_PACKS, ANNUAL_MONTHS_CHARGED, ANCHOR_WAS_USD, REPLACED_VENDORS, VENDORS_TOTAL_MONTHLY_USD, NICHES,
  annualUsd, annualPerMonthUsd, nicheUsd, bookedCallsFor, CREDITS_PER_BOOKED_CALL,
} from "../../lib/agentProgram/config";
import { priceDisplay, creditsMath, OFFERS, roiEstimate, fmtCustomers, vendorsTotalLine, HOW_IT_WORKS, HOW_IT_WORKS_SUBLINE, PRICING_FAQ } from "../../lib/agentProgram/pricing";

const t = (k: string) => TIERS.find((x) => x.key === k)!;

test("ground truth: tier numbers match Roman's spec", () => {
  assert.equal(t("trial").monthlyUsd, 0); assert.equal(t("trial").credits, 128);
  assert.equal(t("solo").monthlyUsd, 1497); assert.equal(t("solo").onboardingUsd, 1497); assert.equal(t("solo").credits, 150); assert.equal(t("solo").businesses, 1);
  assert.equal(t("agency").monthlyUsd, 4997); assert.equal(t("agency").onboardingUsd, 4997); assert.equal(t("agency").credits, 500); assert.equal(t("agency").businesses, 5);
  assert.deepEqual(TOP_UP_PACKS.map((p) => [p.credits, p.usd]), [[100, 149], [500, 599], [1000, 999]]);
  assert.equal(CREDITS_PER_BOOKED_CALL, 15);
  assert.equal(bookedCallsFor(150), 10); assert.equal(bookedCallsFor(500), 33); assert.equal(bookedCallsFor(128), 8);
  assert.deepEqual(NICHES.map((n) => n.multiplier), [1.0, 1.5, 3.0]);
  assert.equal(nicheUsd(1497, 1.5), 2246); assert.equal(nicheUsd(1497, 3.0), 4491);
});

test("annual = 10× monthly, per-month equivalent shown; setup never discounted", () => {
  assert.equal(ANNUAL_MONTHS_CHARGED, 10);
  assert.equal(annualUsd(1497), 14970); assert.equal(annualPerMonthUsd(1497), 1247.5);
  const m = priceDisplay(t("solo"), "month"); const y = priceDisplay(t("solo"), "year");
  assert.equal(m.headline, 1497); assert.equal(y.headline, 1247.5);
  assert.match(y.billedLine!, /\$14,970 billed yearly · 2 months free/);
  assert.equal(m.setupLine, y.setupLine); assert.match(m.setupLine, /\$1,497 one-time setup/);
  const trial = priceDisplay(t("trial"), "year");
  assert.equal(trial.headline, 0); assert.equal(trial.billedLine, null); assert.match(trial.setupLine, /128 credits · no card · \d+ days/);
});

test("BLANKS stay blank until Rome fills them — nothing invented", () => {
  // If this fails, someone typed a number Rome didn't give. Remove it or get the number from Rome.
  for (const k of ["solo", "agency"] as const) {
    if (ANCHOR_WAS_USD[k] === null) assert.equal(priceDisplay(t(k), "month").wasUsd, null);
    else assert.ok(ANCHOR_WAS_USD[k]! > t(k).monthlyUsd, "a 'was' price must be higher than the live price");
  }
  assert.equal(REPLACED_VENDORS.length, 6);
  if (VENDORS_TOTAL_MONTHLY_USD === null) assert.equal(vendorsTotalLine(), "Typically thousands a month");
  else assert.match(vendorsTotalLine(), /^\$[\d,]+\/mo$/);
});

test("offer copy carries config numbers (no drift)", () => {
  assert.match(creditsMath(t("solo")), /^150 credits ≈ 10 booked calls\/mo$/);
  assert.match(creditsMath(t("agency")), /^500 credits ≈ 33 booked calls\/mo$/);
  assert.match(OFFERS.trial.makes, /^128 credits ≈ 8 booked calls/);
  assert.match(OFFERS.solo.money, /One \$1,497\/mo instead of six vendors — seo agency, ad manager, web designer, crm consultant, answering service, ops consultant\./);
  assert.match(OFFERS.solo.makes, /150 credits ≈ 10 fully-worked prospects every month\. 10 booked calls\./);
  assert.match(OFFERS.agency.money, /500 pooled credits ≈ 33 booked calls\/mo/);
  assert.match(OFFERS.agency.makes, /5 × \$1,497 = \$7,485\/mo revenue on a \$4,997 cost/);
  assert.equal(HOW_IT_WORKS[0].price, "Solo $1,497 / Agency $4,997, paid once.");
  assert.equal(HOW_IT_WORKS[2].price, "Top-ups anytime: 100/$149, 500/$599, 1,000/$999.");
  assert.equal(PRICING_FAQ.length, 5);
  assert.equal(HOW_IT_WORKS_SUBLINE, "You're not buying software. You're renting an AI employee — $1,497/mo, works 24/7, never quits.");
});

test("ROI calculator: empty or invalid inputs → nothing; valid → live math", () => {
  assert.equal(roiEstimate({ customerValueUsd: null, closeRatePct: 30, tierKey: "solo" }), null);
  assert.equal(roiEstimate({ customerValueUsd: 5000, closeRatePct: null, tierKey: "solo" }), null);
  assert.equal(roiEstimate({ customerValueUsd: 0, closeRatePct: 30, tierKey: "solo" }), null);
  assert.equal(roiEstimate({ customerValueUsd: 5000, closeRatePct: 150, tierKey: "solo" }), null);
  const r = roiEstimate({ customerValueUsd: 5000, closeRatePct: 30, tierKey: "solo" })!;
  assert.deepEqual(r, { calls: 10, customers: 3, revenueUsd: 15000, costUsd: 1497, netUsd: 13503 });
  const a = roiEstimate({ customerValueUsd: 1000, closeRatePct: 25, tierKey: "agency" })!;
  assert.equal(a.calls, 33); assert.equal(a.customers, 8.3); assert.equal(a.revenueUsd, 8300); assert.equal(a.netUsd, 8300 - 4997);
  assert.equal(fmtCustomers(3), "3"); assert.equal(fmtCustomers(8.3), "8.3");
});
