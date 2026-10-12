// Stripe mirror — a READ-ONLY reflection of the Stripe dashboard for a period.
// Rules (Roman, 2026-10-12): display only. This module may call list/retrieve
// endpoints and nothing else — no charges, refunds, customer or subscription
// changes from inside SFB. tests/lib/analyticsMirror.test.ts statically
// asserts no mutating Stripe method appears in this file. Pulls are cached
// (lib/team/analytics/cache.ts), never made on every page load.
import type Stripe from "stripe";
import { getStripeClient } from "@/lib/billing/stripe";
import type { AnalyticsRange, BucketGranularity } from "./types";
import { getRangeStart, getBucketGranularity } from "./date-range";

export type MirrorCharge = { amount: number; amount_refunded: number; status: string; created: number; currency: string; paid?: boolean; disputed?: boolean };
export type MirrorRefund = { amount: number; created: number; status: string | null };
export type MirrorDispute = { amount: number; created: number; status: string };
export type MirrorCustomer = { created: number };
export type MirrorSubscription = { status: string; items: { unit_amount: number | null; quantity: number; interval: string; interval_count: number }[] };
export type MirrorPayout = { amount: number; created: number; arrival_date: number; status: string };
export type MirrorBalance = { available: number; pending: number };

export type StripeMirror = {
  range: AnalyticsRange; granularity: BucketGranularity; currency: string; rangeStart: string; rangeEnd: string;
  grossVolume: number; netVolume: number; succeededCount: number; failedCount: number; failedAmount: number;
  refundsAmount: number; refundsCount: number; disputesCount: number; disputesAmount: number; disputesOpen: number;
  newCustomers: number; activeSubscriptions: number; pastDueSubscriptions: number; subscriptionMrr: number;
  payoutsPaid: number; payoutsPaidCount: number; payoutsInTransit: number; balanceAvailable: number; balancePending: number;
  timeline: { key: string; label: string; gross: number; refunds: number; charges: number }[];
  truncated: boolean; livemode: boolean;
};

const cents = (n: number) => Math.round(n) / 100;
const MONTHLY: Record<string, number> = { day: 30, week: 52 / 12, month: 1, year: 1 / 12 };

/** Pure: aggregate already-fetched Stripe objects into the mirror. Everything in dollars, 2 dp. */
export function aggregateStripe(input: { charges: MirrorCharge[]; refunds: MirrorRefund[]; disputes: MirrorDispute[]; customers: MirrorCustomer[]; subscriptions: MirrorSubscription[]; payouts: MirrorPayout[]; balance: MirrorBalance; range: AnalyticsRange; rangeStart: Date; rangeEnd: Date; truncated?: boolean; livemode?: boolean; currency?: string }): StripeMirror {
  const g = getBucketGranularity(input.range);
  const succeeded = input.charges.filter((c) => c.status === "succeeded");
  const failed = input.charges.filter((c) => c.status === "failed");
  const gross = succeeded.reduce((s, c) => s + c.amount, 0);
  const refundsAmount = input.refunds.filter((r) => r.status !== "failed" && r.status !== "canceled").reduce((s, r) => s + r.amount, 0);
  const active = input.subscriptions.filter((s) => s.status === "active" || s.status === "trialing");
  const mrrCents = active.reduce((s, sub) => s + sub.items.reduce((t, it) => t + (it.unit_amount ?? 0) * (it.quantity || 1) * (MONTHLY[it.interval] ?? 1) / (it.interval_count || 1), 0), 0);
  const paidPayouts = input.payouts.filter((p) => p.status === "paid");
  const inTransit = input.payouts.filter((p) => p.status === "pending" || p.status === "in_transit");

  // Timeline buckets, oldest → newest.
  const key = (ts: number) => { const d = new Date(ts * 1000); if (g === "hour") { d.setMinutes(0, 0, 0); return d.toISOString(); } d.setHours(0, 0, 0, 0); if (g === "week") d.setDate(d.getDate() - d.getDay()); if (g === "month") d.setDate(1); return d.toISOString(); };
  const label = (iso: string) => { const d = new Date(iso); return g === "hour" ? d.toLocaleTimeString("en-US", { hour: "numeric" }) : g === "month" ? d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }) : d.toLocaleDateString("en-US", { month: "short", day: "numeric" }); };
  const buckets = new Map<string, { gross: number; refunds: number; charges: number }>();
  for (let t = input.rangeStart.getTime(); t <= input.rangeEnd.getTime(); t += g === "hour" ? 3600e3 : 86400e3) { const k = key(t / 1000); if (!buckets.has(k)) buckets.set(k, { gross: 0, refunds: 0, charges: 0 }); }
  for (const c of succeeded) { const k = key(c.created); const b = buckets.get(k); if (b) { b.gross += c.amount; b.charges++; } }
  for (const r of input.refunds) { const k = key(r.created); const b = buckets.get(k); if (b) b.refunds += r.amount; }
  const timeline = Array.from(buckets.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([k, b]) => ({ key: k, label: label(k), gross: cents(b.gross), refunds: cents(b.refunds), charges: b.charges }));

  return {
    range: input.range, granularity: g, currency: (input.currency ?? succeeded[0]?.currency ?? "usd").toUpperCase(), rangeStart: input.rangeStart.toISOString(), rangeEnd: input.rangeEnd.toISOString(),
    grossVolume: cents(gross), netVolume: cents(gross - refundsAmount), succeededCount: succeeded.length, failedCount: failed.length, failedAmount: cents(failed.reduce((s, c) => s + c.amount, 0)),
    refundsAmount: cents(refundsAmount), refundsCount: input.refunds.length, disputesCount: input.disputes.length, disputesAmount: cents(input.disputes.reduce((s, d) => s + d.amount, 0)), disputesOpen: input.disputes.filter((d) => /needs_response|under_review|warning/.test(d.status)).length,
    newCustomers: input.customers.length, activeSubscriptions: active.length, pastDueSubscriptions: input.subscriptions.filter((s) => s.status === "past_due" || s.status === "unpaid").length, subscriptionMrr: cents(mrrCents),
    payoutsPaid: cents(paidPayouts.reduce((s, p) => s + p.amount, 0)), payoutsPaidCount: paidPayouts.length, payoutsInTransit: cents(inTransit.reduce((s, p) => s + p.amount, 0)), balanceAvailable: cents(input.balance.available), balancePending: cents(input.balance.pending),
    timeline, truncated: !!input.truncated, livemode: input.livemode ?? true,
  };
}

const PAGE_CAP = 2000; // per list; beyond this the mirror says "truncated" rather than silently under-counting

async function listAll<T>(fn: (params: Record<string, unknown>) => Stripe.ApiListPromise<T>, params: Record<string, unknown>): Promise<{ data: T[]; truncated: boolean }> {
  const data = await fn({ ...params, limit: 100 }).autoPagingToArray({ limit: PAGE_CAP });
  return { data, truncated: data.length >= PAGE_CAP };
}

/** Live pull. Read-only by construction: list + retrieve only. */
export async function fetchStripeMirror(range: AnalyticsRange): Promise<StripeMirror> {
  const stripe = getStripeClient();
  const rangeEnd = new Date();
  // "all" anchors to the first charge ever; fetched cheaply (one object).
  let earliest = new Date();
  if (range === "all") { const all = await stripe.charges.list({ limit: 100 }).autoPagingToArray({ limit: PAGE_CAP }); /* newest first → last element is the oldest we can see */ const o = all[all.length - 1]; if (o) earliest = new Date(o.created * 1000); }
  const rangeStart = getRangeStart(range, earliest);
  const created = { gte: Math.floor(rangeStart.getTime() / 1000), lte: Math.floor(rangeEnd.getTime() / 1000) };
  const [charges, refunds, disputes, customers, subs, payouts, balance] = await Promise.all([
    listAll((p) => stripe.charges.list(p), { created }),
    listAll((p) => stripe.refunds.list(p), { created }),
    listAll((p) => stripe.disputes.list(p), { created }),
    listAll((p) => stripe.customers.list(p), { created }),
    listAll((p) => stripe.subscriptions.list(p), { status: "all" }),
    listAll((p) => stripe.payouts.list(p), { created }),
    stripe.balance.retrieve(),
  ]);
  const cur = (balance.available[0]?.currency ?? "usd");
  return aggregateStripe({
    charges: charges.data.map((c) => ({ amount: c.amount, amount_refunded: c.amount_refunded, status: c.status, created: c.created, currency: c.currency, paid: c.paid, disputed: c.disputed })),
    refunds: refunds.data.map((r) => ({ amount: r.amount, created: r.created, status: r.status })),
    disputes: disputes.data.map((d) => ({ amount: d.amount, created: d.created, status: d.status })),
    customers: customers.data.map((c) => ({ created: c.created })),
    subscriptions: subs.data.filter((s) => s.status !== "canceled" && s.status !== "incomplete_expired").map((s) => ({ status: s.status, items: s.items.data.map((it) => ({ unit_amount: it.price.unit_amount, quantity: it.quantity ?? 1, interval: it.price.recurring?.interval ?? "month", interval_count: it.price.recurring?.interval_count ?? 1 })) })),
    payouts: payouts.data.map((p) => ({ amount: p.amount, created: p.created, arrival_date: p.arrival_date, status: p.status })),
    balance: { available: balance.available.filter((b) => b.currency === cur).reduce((s, b) => s + b.amount, 0), pending: balance.pending.filter((b) => b.currency === cur).reduce((s, b) => s + b.amount, 0) },
    range, rangeStart, rangeEnd, truncated: charges.truncated || refunds.truncated || customers.truncated || subs.truncated || payouts.truncated, livemode: balance.livemode, currency: cur,
  });
}
