// Step 10 — first campaign, pure planning rules (tested). The campaign is the
// outbound engine's existing path (enrich → draft → human approval → send);
// this module only decides how much of it the balance can afford and
// summarizes outcomes. Every price comes from CREDIT_PRICES.
import { creditPrice } from "@/lib/agentProgram/config";

export const LAUNCH_BATCH = 10;

export const PRICES = {
  enrich: creditPrice("outbound.prospect_enriched")?.credits ?? 0,
  write: creditPrice("outbound.message_written")?.credits ?? 0,
  review: creditPrice("human.review_pass")?.credits ?? 0,
};

/** Cost to take one prospect through enrich + first draft (the review pass is charged only when the customer approves). */
export const perProspectCredits = () => PRICES.enrich + PRICES.write;

export type LaunchPlan = { count: number; estimatedCredits: number; topUp: boolean; reason: string | null };

/** How many of the available prospects this balance can afford (never negative, never a dead end).
 *  `withEmail` prospects (uploaded lists, enriched earlier) skip the site read and are drafted first, so they cost only the write price. */
export function planLaunch(availableProspects: number, balance: number, batch = LAUNCH_BATCH, withEmail = 0): LaunchPlan {
  if (availableProspects <= 0) return { count: 0, estimatedCredits: 0, topUp: false, reason: "no_prospects" };
  if (balance <= 0) return { count: 0, estimatedCredits: 0, topUp: true, reason: "out_of_credits" };
  let count = 0; let estimatedCredits = 0;
  for (let i = 0; i < Math.min(batch, availableProspects); i++) {
    const cost = i < withEmail ? PRICES.write : perProspectCredits();
    if (estimatedCredits + cost > balance) break;
    estimatedCredits += cost; count++;
  }
  if (count === 0) return { count: 0, estimatedCredits: 0, topUp: true, reason: "insufficient_for_one" };
  return { count, estimatedCredits, topUp: false, reason: null };
}

export type LaunchResult = { prospectId: string; name: string; outcome: "drafted" | "no_email" | "no_website" | "paused" | "error"; detail?: string };
export function summarizeLaunch(results: LaunchResult[]) {
  const by = (o: LaunchResult["outcome"]) => results.filter((r) => r.outcome === o).length;
  return { drafted: by("drafted"), noEmail: by("no_email") + by("no_website"), paused: by("paused"), errors: by("error"), total: results.length };
}
