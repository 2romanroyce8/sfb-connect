// Post-payment onboarding — the 11 steps (Roman, 2026-10-12).
// Pure derivation lives here so it can be tested without a database: given
// what is really stored for a business, which steps are done, which is next,
// and what is gated. Steps 2 and 3 are the only hard gates; everything else
// can be finished later from the dashboard checklist.

export type StepNo = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;
export type StepDef = { no: StepNo; slug: string; title: string; short: string; required: boolean; derived: boolean };

export const STEPS: StepDef[] = [
  { no: 1, slug: "profile", title: "Business profile", short: "Confirm what your agent knows about you.", required: false, derived: false },
  { no: 2, slug: "gmail", title: "Connect Gmail", short: "Powers outbound — your agent sends from your address.", required: true, derived: true },
  { no: 3, slug: "calendar", title: "Connect Google Calendar", short: "Powers booking — calls land on your calendar.", required: true, derived: true },
  { no: 4, slug: "brand", title: "Brand assets", short: "Logo and colors, pulled from your site or uploaded.", required: false, derived: false },
  { no: 5, slug: "capabilities", title: "Capabilities", short: "Eight switches, plain language.", required: false, derived: false },
  { no: 6, slug: "icp", title: "Ideal customer", short: "Who you want more of: industry, location, size.", required: false, derived: true },
  { no: 7, slug: "leads", title: "Lead list", short: "Your agent finds them; you review.", required: false, derived: true },
  { no: 8, slug: "automations", title: "Automations", short: "Follow-up sequences, templates pre-filled.", required: false, derived: true },
  { no: 9, slug: "dfy", title: "Want us to run it?", short: "Done-for-you, or keep going yourself.", required: false, derived: true },
  { no: 10, slug: "campaign", title: "First campaign", short: "Drafts → your approval → launch.", required: false, derived: true },
  { no: 11, slug: "dashboard", title: "Dashboard", short: "Watch your agent work.", required: false, derived: false },
];
export const stepBySlug = (slug: string) => STEPS.find((s) => s.slug === slug) ?? null;
export const stepByNo = (no: number) => STEPS.find((s) => s.no === no) ?? null;

/** Everything the derivation needs, gathered by the server. */
export type OnboardingFacts = {
  gmailConnected: boolean;
  calendarConnected: boolean;
  hasLogo: boolean;
  hasIcp: boolean;
  prospectCount: number;
  activeSequence: boolean;
  dfyChoice: string | null;
  campaignLaunched: boolean;          // ≥1 prospect in_sequence / message sent or approved
  confirmedSteps: Record<string, string>;
  dismissedAt: string | null;
  completedAt: string | null;
};

export type StepState = StepDef & { done: boolean; locked: boolean; lockReason: string | null };
export type OnboardingState = {
  steps: StepState[];
  current: StepNo;              // first not-done unlocked step (11 when all done)
  gatesPassed: boolean;         // steps 2 and 3 done
  remaining: StepState[];       // not done, for dashboard nudges
  showFlow: boolean;            // dashboard should redirect into the flow (gates not passed and not dismissed/completed)
  percent: number;
  completed: boolean;
  dismissed: boolean;
};

export function deriveOnboarding(f: OnboardingFacts): OnboardingState {
  const c = f.confirmedSteps ?? {};
  const doneMap: Record<StepNo, boolean> = {
    1: !!c["1"], 2: f.gmailConnected, 3: f.calendarConnected, 4: f.hasLogo || !!c["4"], 5: !!c["5"],
    6: f.hasIcp, 7: f.prospectCount > 0 && !!c["7"], 8: f.activeSequence, 9: !!f.dfyChoice, 10: f.campaignLaunched, 11: !!c["11"] || !!f.completedAt,
  };
  const gatesPassed = doneMap[2] && doneMap[3];
  const steps: StepState[] = STEPS.map((s) => {
    const locked = s.no >= 4 && !gatesPassed;
    return { ...s, done: doneMap[s.no], locked, lockReason: locked ? "Connect Gmail and Google Calendar first — they power everything after this." : null };
  });
  const firstOpen = steps.find((s) => !s.done && !s.locked);
  const current = (firstOpen?.no ?? 11) as StepNo;
  const doneCount = steps.filter((s) => s.done).length;
  return {
    steps, current, gatesPassed,
    remaining: steps.filter((s) => !s.done),
    showFlow: !f.completedAt && !f.dismissedAt && !gatesPassed,
    percent: Math.round((doneCount / STEPS.length) * 100),
    completed: !!f.completedAt, dismissed: !!f.dismissedAt,
  };
}

/** Step 1 payload validation (also reused by the dashboard "edit profile" later). */
export function parseProfileInput(b: Record<string, unknown>): { error: string } | { patch: Record<string, unknown> } {
  const s = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
  const legal_name = s(b.businessName, 120); if (legal_name.length < 2) return { error: "Business name is required." };
  const website = s(b.website, 300); if (website && !/^https?:\/\/[^\s]+\.[^\s]+$/i.test(website)) return { error: "Website should be a full URL (https://…)." };
  const primary_category = s(b.category, 80) || null;
  const niche_tags = Array.isArray(b.nicheTags) ? (b.nicheTags as unknown[]).map((t) => s(t, 40)).filter(Boolean).slice(0, 5) : [];
  const city = s(b.city, 80) || null; const state = s(b.state, 2).toUpperCase() || null;
  if (state && !/^[A-Z]{2}$/.test(state)) return { error: "State should be the two-letter code." };
  const phone = s(b.phone, 32) || null;
  const services = Array.isArray(b.services) ? (b.services as unknown[]).map((t) => s(t, 80)).filter(Boolean).slice(0, 12) : [];
  const outbound_offer_line = s(b.offerLine, 200) || null;
  const description = s(b.description, 600) || null;
  return { patch: { legal_name, website: website || null, primary_category, niche_tags, city, state, phone, services, outbound_offer_line, description, updated_at: new Date().toISOString() } };
}

/** Pick brand colors out of HTML/CSS: theme-color first, then the most-used non-grey hex values. */
export function extractBrandColors(html: string): string[] {
  const out: string[] = [];
  const theme = html.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["'](#[0-9a-f]{3,8})["']/i)?.[1];
  if (theme) out.push(normHex(theme));
  const counts = new Map<string, number>();
  for (const m of html.matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi)) {
    const hex = normHex(`#${m[1]}`); if (!hex || isGrey(hex)) continue;
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }
  for (const [hex] of Array.from(counts.entries()).sort((a, b) => b[1] - a[1])) { if (!out.includes(hex)) out.push(hex); if (out.length >= 4) break; }
  return out;
}
function normHex(h: string): string { const x = h.replace("#", "").toLowerCase(); const six = x.length === 3 ? x.split("").map((c) => c + c).join("") : x.slice(0, 6); return `#${six}`; }
function isGrey(hex: string): boolean { const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16); const max = Math.max(r, g, b), min = Math.min(r, g, b); return max - min < 24 || min > 230 || max < 25; }
