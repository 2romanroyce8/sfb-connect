// Company analytics — how the business is doing, from OUR records (not Stripe):
// money actually collected (paid plan orders, completed add-on/credit
// purchases, confirmed manual payments), revenue booked in the CRM
// (revenue_events), active clients, MRR from active plans, and the pipeline
// by stage. Every figure here is a sum over rows that exist; nothing is
// projected or inferred.
import type { SupabaseClient } from "@supabase/supabase-js";
import { SFB_PLAN_PRICES, SFB_PLAN_LABELS, isPlanKey } from "@/lib/team/plans";
import { TIERS, annualPerMonthUsd } from "@/lib/agentProgram/config";
import type { AnalyticsRange, BucketGranularity } from "./types";
import { getRangeStart, getBucketGranularity, getPreviousRangeBounds } from "./date-range";

export const PIPELINE_STAGES = ["demo_requested", "new", "researching", "ready_to_call", "contacted", "interested", "meeting_booked", "meeting_completed", "proposal", "won", "lost", "follow_up", "nurture"] as const;
export const STAGE_LABELS: Record<string, string> = { demo_requested: "Demo requested", new: "New", researching: "Researching", ready_to_call: "Ready to call", contacted: "Contacted", interested: "Interested", meeting_booked: "Meeting booked", meeting_completed: "Meeting completed", proposal: "Proposal", won: "Won", lost: "Lost", follow_up: "Follow-up", nurture: "Nurture" };
const OPEN_STAGES = new Set(["demo_requested", "new", "researching", "ready_to_call", "contacted", "interested", "meeting_booked", "meeting_completed", "proposal", "follow_up", "nurture"]);

export type CompanyAnalytics = {
  range: AnalyticsRange; granularity: BucketGranularity; rangeStart: string; rangeEnd: string;
  collected: { total: number; planOrders: number; addons: number; manualPayments: number; count: number; previousTotal: number | null };
  booked: { total: number; newSales: number; renewals: number; refunds: number; count: number };
  clients: { active: number; newInRange: number; byPlan: { planKey: string; label: string; count: number; monthlyUsd: number }[] };
  mrr: { total: number; basis: string };
  pipeline: { stage: string; label: string; count: number; estValue: number | null }[];
  pipelineOpen: { count: number; estValue: number };
  wonInRange: number;
  timeline: { key: string; label: string; collected: number }[];
};

const usd = (c: number) => Math.round(c) / 100;

function bucketKey(d: Date, g: BucketGranularity) { const t = new Date(d); if (g === "hour") { t.setMinutes(0, 0, 0); return t.toISOString(); } t.setHours(0, 0, 0, 0); if (g === "week") t.setDate(t.getDate() - t.getDay()); if (g === "month") t.setDate(1); return t.toISOString(); }
function bucketLabel(iso: string, g: BucketGranularity) { const d = new Date(iso); return g === "hour" ? d.toLocaleTimeString("en-US", { hour: "numeric" }) : g === "month" ? d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }) : d.toLocaleDateString("en-US", { month: "short", day: "numeric" }); }

/** Pure: MRR for active businesses from their plan + latest paid order's interval (annual → per-month equivalent). */
export function computeMrr<B extends { plan_key: string | null }>(businesses: B[], intervals: Map<string, string>, index: (b: B) => string): { total: number; byPlan: Record<string, number> } {
  const byPlan: Record<string, number> = {}; let total = 0;
  for (const b of businesses) {
    if (!b.plan_key) continue;
    const tier = TIERS.find((t) => t.key === b.plan_key);
    let monthly = tier ? tier.monthlyUsd : isPlanKey(b.plan_key) ? SFB_PLAN_PRICES[b.plan_key] : 0;
    if (tier && intervals.get(index(b)) === "year") monthly = annualPerMonthUsd(tier.monthlyUsd);
    byPlan[b.plan_key] = (byPlan[b.plan_key] ?? 0) + monthly; total += monthly;
  }
  return { total: Math.round(total * 100) / 100, byPlan };
}

export async function getCompanyAnalytics(service: SupabaseClient, range: AnalyticsRange): Promise<CompanyAnalytics> {
  const g = getBucketGranularity(range);
  let earliest = new Date();
  if (range === "all") { const { data } = await service.from("agent_plan_orders").select("paid_at").not("paid_at", "is", null).order("paid_at", { ascending: true }).limit(1); if (data?.[0]?.paid_at) earliest = new Date(data[0].paid_at as string); }
  const rangeStart = getRangeStart(range, earliest); const rangeEnd = new Date(); const prev = getPreviousRangeBounds(range, rangeStart);
  const iso = (d: Date) => d.toISOString();

  const [orders, addons, payments, revEvents, businesses, leads, prevOrders, prevAddons, prevPayments, latestOrders] = await Promise.all([
    service.from("agent_plan_orders").select("amount_total_cents, paid_at, plan_key, business_id").in("status", ["paid", "provisioned"]).not("paid_at", "is", null).gte("paid_at", iso(rangeStart)).lte("paid_at", iso(rangeEnd)),
    service.from("addon_purchases").select("amount_cents, completed_at, purchase_type").eq("status", "completed").not("completed_at", "is", null).gte("completed_at", iso(rangeStart)).lte("completed_at", iso(rangeEnd)),
    service.from("payments").select("amount_cents, created_at").eq("status", "confirmed").gte("created_at", iso(rangeStart)).lte("created_at", iso(rangeEnd)),
    service.from("revenue_events").select("amount, event_type, occurred_at").is("reversed_at", null).gte("occurred_at", iso(rangeStart)).lte("occurred_at", iso(rangeEnd)),
    // is_house_account = SFB Connect's own business (the outbound sender) — not a client, never MRR (2026-10-19).
    service.from("businesses").select("id, plan_key, created_at").not("plan_key", "is", null).eq("is_sandbox", false).eq("is_house_account", false),
    service.from("crm_leads").select("pipeline_stage, recommended_offer, updated_at").eq("archived", false),
    prev ? service.from("agent_plan_orders").select("amount_total_cents").in("status", ["paid", "provisioned"]).gte("paid_at", iso(prev.start)).lte("paid_at", iso(prev.end)) : Promise.resolve({ data: null }),
    prev ? service.from("addon_purchases").select("amount_cents").eq("status", "completed").gte("completed_at", iso(prev.start)).lte("completed_at", iso(prev.end)) : Promise.resolve({ data: null }),
    prev ? service.from("payments").select("amount_cents").eq("status", "confirmed").gte("created_at", iso(prev.start)).lte("created_at", iso(prev.end)) : Promise.resolve({ data: null }),
    service.from("agent_plan_orders").select("business_id, billing_interval, paid_at").in("status", ["paid", "provisioned"]).not("business_id", "is", null).order("paid_at", { ascending: false }),
  ]);

  const sum = (rows: { [k: string]: unknown }[] | null | undefined, k: string) => (rows ?? []).reduce((s, r) => s + Number(r[k] ?? 0), 0);
  const planOrders = sum(orders.data, "amount_total_cents"), addonsC = sum(addons.data, "amount_cents"), manual = sum(payments.data, "amount_cents");
  const prevTotal = prev ? usd(sum(prevOrders.data, "amount_total_cents") + sum(prevAddons.data, "amount_cents") + sum(prevPayments.data, "amount_cents")) : null;

  const ev = revEvents.data ?? [];
  const evSum = (types: string[]) => ev.filter((e) => types.includes(e.event_type as string)).reduce((s, e) => s + Number(e.amount), 0);
  const booked = { newSales: evSum(["new_sale"]), renewals: evSum(["renewal", "upgrade"]), refunds: evSum(["refund"]) };

  const biz = businesses.data ?? [];
  const intervals = new Map<string, string>(); for (const o of latestOrders.data ?? []) if (!intervals.has(o.business_id as string)) intervals.set(o.business_id as string, (o.billing_interval as string) ?? "month");
  const mrr = computeMrr(biz as { plan_key: string | null; id: string }[], intervals, (b) => b.id);
  const byPlanCount = new Map<string, number>(); for (const b of biz) byPlanCount.set(b.plan_key as string, (byPlanCount.get(b.plan_key as string) ?? 0) + 1);
  const byPlan = Array.from(byPlanCount.entries()).map(([planKey, count]) => ({ planKey, label: isPlanKey(planKey) ? SFB_PLAN_LABELS[planKey] : planKey, count, monthlyUsd: mrr.byPlan[planKey] ?? 0 }));

  const ls = leads.data ?? [];
  const pipeline = PIPELINE_STAGES.map((stage) => { const rows = ls.filter((l) => l.pipeline_stage === stage); const known: number[] = []; for (const l of rows) if (isPlanKey(l.recommended_offer)) known.push(Number(SFB_PLAN_PRICES[l.recommended_offer])); return { stage, label: STAGE_LABELS[stage], count: rows.length, estValue: known.length ? Math.round(known.reduce((s, v) => s + v, 0) * 100) / 100 : null }; });
  const open = pipeline.filter((p) => OPEN_STAGES.has(p.stage));
  const wonInRange = ls.filter((l) => l.pipeline_stage === "won" && l.updated_at && new Date(l.updated_at as string) >= rangeStart).length;

  const buckets = new Map<string, number>();
  for (let t = rangeStart.getTime(); t <= rangeEnd.getTime(); t += g === "hour" ? 3600e3 : 86400e3) buckets.set(bucketKey(new Date(t), g), 0);
  const add = (at: string | null, c: number) => { if (!at) return; const k = bucketKey(new Date(at), g); if (buckets.has(k)) buckets.set(k, (buckets.get(k) ?? 0) + c); };
  for (const o of orders.data ?? []) add(o.paid_at as string, Number(o.amount_total_cents));
  for (const a of addons.data ?? []) add(a.completed_at as string, Number(a.amount_cents));
  for (const p of payments.data ?? []) add(p.created_at as string, Number(p.amount_cents));

  return {
    range, granularity: g, rangeStart: iso(rangeStart), rangeEnd: iso(rangeEnd),
    collected: { total: usd(planOrders + addonsC + manual), planOrders: usd(planOrders), addons: usd(addonsC), manualPayments: usd(manual), count: (orders.data?.length ?? 0) + (addons.data?.length ?? 0) + (payments.data?.length ?? 0), previousTotal: prevTotal },
    booked: { total: Math.round((booked.newSales + booked.renewals - booked.refunds) * 100) / 100, newSales: booked.newSales, renewals: booked.renewals, refunds: booked.refunds, count: ev.length },
    clients: { active: biz.length, newInRange: biz.filter((b) => new Date(b.created_at as string) >= rangeStart).length, byPlan },
    mrr: { total: mrr.total, basis: "active plans × their monthly price (annual plans at the per-month equivalent); not a Stripe figure" },
    pipeline, pipelineOpen: { count: open.reduce((s, p) => s + p.count, 0), estValue: Math.round(open.reduce((s, p) => s + (p.estValue ?? 0), 0) * 100) / 100 }, wonInRange,
    timeline: Array.from(buckets.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([k, c]) => ({ key: k, label: bucketLabel(k, g), collected: usd(c) })),
  };
}
