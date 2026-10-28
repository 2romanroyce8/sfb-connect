// Order rules (pure, client-safe). The status path is the one in the product brief; the database enforces the same set of values.
export const STATUSES = ["draft", "quoted", "awaiting_approval", "onboarding", "in_development", "qa", "client_review", "live", "maintenance", "canceled"] as const;
export type OrderStatus = (typeof STATUSES)[number];
export const STATUS_LABEL: Record<OrderStatus, string> = { draft: "Draft", quoted: "Quoted", awaiting_approval: "Awaiting approval", onboarding: "Onboarding", in_development: "In development", qa: "QA", client_review: "Client review", live: "Live", maintenance: "Maintenance", canceled: "Canceled" };
export const FORWARD: OrderStatus[] = ["draft", "quoted", "awaiting_approval", "onboarding", "in_development", "qa", "client_review", "live", "maintenance"];

/** Allowed moves: one step forward, one step back (to fix a mistake), or cancel from any open state. Canceled is final. Jumping ahead is refused. */
export function canMove(from: string, to: string): { ok: true } | { ok: false; reason: string } {
  if (!STATUSES.includes(from as OrderStatus) || !STATUSES.includes(to as OrderStatus)) return { ok: false, reason: "Unknown status." };
  if (from === to) return { ok: false, reason: "Already there." };
  if (from === "canceled") return { ok: false, reason: "A canceled order can't be reopened. Create a new one." };
  if (to === "canceled") return { ok: true };
  const i = FORWARD.indexOf(from as OrderStatus), j = FORWARD.indexOf(to as OrderStatus);
  if (j === i + 1 || j === i - 1) return { ok: true };
  return { ok: false, reason: `Move one step at a time (next after ${STATUS_LABEL[from as OrderStatus]} is ${STATUS_LABEL[FORWARD[i + 1]] ?? "none"}).` };
}
/** A quote needs a retail price; going live needs the client's onboarding to be approved. Checked server-side with real data. */
export function gateFor(to: string, o: { price_setup_cents: number; price_monthly_cents: number }, onboardingApproved: boolean): string | null {
  if (to === "quoted" && o.price_setup_cents + o.price_monthly_cents <= 0) return "Set a retail price before quoting.";
  if (["in_development", "qa", "client_review", "live"].includes(to) && !onboardingApproved) return "The client's onboarding must be approved first.";
  return null;
}
export type Money = { cost_setup_cents: number; cost_monthly_cents: number; price_setup_cents: number; price_monthly_cents: number };
/** Margin from the agency's own entered numbers. Percent is of retail; null when there is no retail price (never a made-up 0%). */
export function margin(m: Money) {
  const f = (price: number, cost: number) => ({ profit: price - cost, pct: price > 0 ? ((price - cost) / price) * 100 : null });
  return { setup: f(m.price_setup_cents, m.cost_setup_cents), monthly: f(m.price_monthly_cents, m.cost_monthly_cents), yearlyRecurringProfit: (m.price_monthly_cents - m.cost_monthly_cents) * 12 };
}
export const usd = (c: number) => `${c < 0 ? "-" : ""}$${(Math.abs(c) / 100).toLocaleString("en-US", { minimumFractionDigits: Math.abs(c) % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
export const toCents = (v: unknown): number | null => { const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v.replace(/[$,\s]/g, "")) : NaN; return Number.isFinite(n) && n >= 0 && n <= 10_000_000 ? Math.round(n * 100) : null; };
