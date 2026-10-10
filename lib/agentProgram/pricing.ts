// ============================================================
// PRICING PAGE — derived copy and math. Every number here is computed from
// lib/agentProgram/config.ts so the page can never drift from checkout or
// the ledger. Copy is Roman's pricing spec (2026-10-10) verbatim, with the
// numbers inside it substituted from config.
// ============================================================
import {
  TIERS, TOP_UP_PACKS, CREDITS_PER_BOOKED_CALL, ANNUAL_MONTHS_CHARGED, ANCHOR_WAS_USD, REPLACED_VENDORS, VENDORS_TOTAL_MONTHLY_USD,
  bookedCallsFor, annualUsd, annualPerMonthUsd, fmtUsd, tier, type Tier, type TierKey, type BillingInterval,
} from "./config";

const T = (key: TierKey): Tier => TIERS.find((t) => t.key === key)!;
const trial = T("trial"); const solo = T("solo"); const agency = T("agency");

// ---- §1 How it works ----
export const HOW_IT_WORKS_HEADLINE = "One build. One monthly. That's it.";
// Hero subline (Roman, 2026-10-10). The price is config, not typed.
export const HOW_IT_WORKS_SUBLINE = `You're not buying software. You're renting an AI employee — ${fmtUsd(solo.monthlyUsd)}/mo, works 24/7, never quits.`;
export const HOW_IT_WORKS = [
  {
    n: 1, title: "One-time setup", price: `Solo ${fmtUsd(solo.onboardingUsd)} / Agency ${fmtUsd(agency.onboardingUsd)}, paid once.`,
    body: "We build your agent: connect your business, plug in your tools, switch on capabilities. You approve its first 3 tasks.",
    tag: "The build — pay once, never again.",
  },
  {
    n: 2, title: "Monthly membership", price: `${fmtUsd(solo.monthlyUsd)}/mo / ${fmtUsd(agency.monthlyUsd)}/mo.`,
    body: "Keeps your agent running 24/7, refills credits monthly.",
    tag: "The fuel — cancel anytime.",
  },
  {
    n: 3, title: "Need more fuel?", price: `Top-ups anytime: ${TOP_UP_PACKS.map((p) => `${p.credits.toLocaleString("en-US")}/${fmtUsd(p.usd)}`).join(", ")}.`,
    body: "Never expire.",
    tag: "Extra credits — only when you want them.",
  },
] as const;

// ---- §2 Price display per interval ----
export type PriceDisplay = { headline: number; unit: string; billedLine: string | null; setupLine: string; wasUsd: number | null };
/** What the big number on a card says for the chosen interval. Setup is one-time and never discounted. */
export function priceDisplay(t: Tier, interval: BillingInterval): PriceDisplay {
  const wasUsd = t.key === "solo" || t.key === "agency" ? ANCHOR_WAS_USD[t.key] : null;
  if (t.monthlyUsd === 0) return { headline: 0, unit: "", billedLine: null, setupLine: `${t.credits} credits · no card · ${t.trialDays} days`, wasUsd: null };
  const setupLine = `+ ${fmtUsd(t.onboardingUsd)} one-time setup`;
  if (interval === "year") {
    return { headline: annualPerMonthUsd(t.monthlyUsd), unit: "/mo", billedLine: `${fmtUsd(annualUsd(t.monthlyUsd))} billed yearly · ${12 - ANNUAL_MONTHS_CHARGED} months free`, setupLine, wasUsd: wasUsd === null ? null : annualPerMonthUsd(wasUsd) };
  }
  return { headline: t.monthlyUsd, unit: "/mo", billedLine: "Billed monthly · cancel anytime", setupLine, wasUsd };
}
/** "150 credits ≈ 10 booked calls/mo" — concrete math on every card. */
export const creditsMath = (t: Tier) => t.monthlyUsd === 0
  ? `${t.credits} credits ≈ ${bookedCallsFor(t.credits)} booked calls of agent work`
  : `${t.credits} credits ≈ ${bookedCallsFor(t.credits)} booked calls/mo`;

// ---- §3 THE OFFER (Roman's copy; numbers from config) ----
export type Offer = { problem: string; time: string; money: string; makes: string; timeLabel: string; moneyLabel: string; makesLabel: string };
const agencyResale = agency.businesses * solo.monthlyUsd;
export const OFFERS: Record<TierKey, Offer> = {
  trial: {
    problem: "You don't believe an AI can run your marketing. Fair — don't take our word for it.",
    timeLabel: "Time", time: "5 minutes to pick a demo business. The agent starts working instantly.",
    moneyLabel: "Money", money: "Costs $0. If it can't impress you for free, it doesn't deserve your money.",
    makesLabel: "Makes money", makes: `${trial.credits} credits ≈ ${bookedCallsFor(trial.credits)} booked calls of real agent work on demo data. Watch exactly what it would do for your business — then decide.`,
  },
  solo: {
    problem: "Every week you lose jobs to competitors who answer faster, follow up relentlessly, and show up when customers ask AI who to hire. You're the bottleneck — there's only one of you.",
    timeLabel: "Saves TIME now", time: "Your agent works 24/7: finds prospects, writes outreach, follows up, books calls into your calendar, answers website chat, asks happy customers for reviews, keeps your listings correct. A marketer, an SDR, and an ops assistant that never sleeps, never quits, never calls in sick.",
    moneyLabel: "Saves MONEY now", money: `One ${fmtUsd(solo.monthlyUsd)}/mo instead of six vendors — ${REPLACED_VENDORS.map((v) => v.name.toLowerCase()).join(", ")}.`,
    makesLabel: "Makes MONEY now", makes: `${solo.credits} credits ≈ ${bookedCallsFor(solo.credits)} fully-worked prospects every month. ${bookedCallsFor(solo.credits)} booked calls. Use the calculator below — type what one customer is worth and see the math.`,
  },
  agency: {
    problem: "You sell marketing services, but fulfillment eats your margin — manual work, inconsistent delivery, clients churn.",
    timeLabel: "Saves TIME now", time: `The agent fulfills for ${agency.businesses} client spaces at once — outreach, follow-up, booking, reviews, reporting — while you sell.`,
    moneyLabel: "Saves MONEY now", money: `One ${fmtUsd(agency.monthlyUsd)}/mo instead of a fulfillment team. ${agency.credits} pooled credits ≈ ${bookedCallsFor(agency.credits)} booked calls/mo across clients.`,
    makesLabel: "Makes MONEY now", makes: `Resell each client space at ${fmtUsd(solo.monthlyUsd)}+/mo: ${agency.businesses} × ${fmtUsd(solo.monthlyUsd)} = ${fmtUsd(agencyResale)}/mo revenue on a ${fmtUsd(agency.monthlyUsd)} cost. Your logo on everything.`,
  },
};

// ---- §4 ROI calculator (pure) ----
export type RoiInput = { customerValueUsd: number | null; closeRatePct: number | null; tierKey: "solo" | "agency" };
export type RoiResult = { calls: number; customers: number; revenueUsd: number; costUsd: number; netUsd: number } | null;
/** Empty or invalid inputs → null (the UI shows nothing; no invented defaults). */
export function roiEstimate(i: RoiInput): RoiResult {
  const t = tier(i.tierKey);
  if (!t || i.customerValueUsd === null || i.closeRatePct === null) return null;
  if (!Number.isFinite(i.customerValueUsd) || !Number.isFinite(i.closeRatePct) || i.customerValueUsd <= 0 || i.closeRatePct <= 0 || i.closeRatePct > 100) return null;
  const calls = bookedCallsFor(t.credits);
  const customers = Math.round(calls * (i.closeRatePct / 100) * 10) / 10;
  const revenueUsd = Math.round(customers * i.customerValueUsd);
  return { calls, customers, revenueUsd, costUsd: t.monthlyUsd, netUsd: revenueUsd - t.monthlyUsd };
}
export const fmtCustomers = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

// ---- §6 Vendors ----
/** Rome's figure if set, else the fallback he offered ("thousands"). */
export const vendorsTotalLine = () => VENDORS_TOTAL_MONTHLY_USD === null ? "Typically thousands a month" : `${fmtUsd(VENDORS_TOTAL_MONTHLY_USD)}/mo`;
export const VENDOR_GRID_HEADLINE = "Fire six vendors. Keep one agent.";

// ---- §7 FAQ at the point of doubt ----
// Answers reuse published copy only: AGENT_FAQ (Atlas, final), the §1 setup
// step (Roman), and Terms §"Termination" (Atlas): "you may export your data
// within 30 days".
export const PRICING_FAQ = [
  { q: "Do unused credits roll over?", a: "Monthly plan credits reset each billing cycle — they don't roll over. Top-up packs are different: purchased credits never expire while your membership is active." },
  { q: "What if it doesn't work?", a: "Credits pay for work performed — not guaranteed calls, rankings, leads, or revenue. A human approves anything customer-facing before it runs. Failed work — errors, bounces, no result — costs zero credits, always. If it's not working for you, cancel anytime; your plan runs to the end of the paid period." },
  { q: "Is there a contract?", a: "No contracts, no seat fees. Monthly plans cancel anytime and run to the end of the paid period. Months and credit packs are non-refundable — the work happened." },
  { q: "What does setup include?", a: "We build your agent: connect your business, plug in your tools, switch on capabilities. You approve its first 3 tasks. The setup fee is paid once, never again." },
  { q: "What happens to my data if I cancel?", a: "Your access ends at the end of the paid period and you may export your data within 30 days." },
] as const;

export const PLANNING_LINE = `1 booked call ≈ ${CREDITS_PER_BOOKED_CALL} credits of agent work.`;
