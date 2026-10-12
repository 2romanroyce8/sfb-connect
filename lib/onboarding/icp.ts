// Step 6 — ideal customer profile (pure, tested). Guided: industry, location,
// size. Defaults come from the ICP preset for the business's category and its
// own city/state; the user confirms or edits. Also turns an ICP into the
// search queries the lead-list step runs.
import { icpFor } from "@/lib/analyzer/icp";

export const ICP_SIZES = [
  { key: "any", label: "Any size" },
  { key: "solo", label: "Owner-operated (1–5 people)" },
  { key: "small", label: "Small business (5–25)" },
  { key: "mid", label: "Mid-size (25–200)" },
  { key: "large", label: "Large (200+)" },
] as const;
export type IcpSize = (typeof ICP_SIZES)[number]["key"];
export type Icp = { industries: string[]; locations: string[]; size: IcpSize; notes: string | null; source: "preset" | "user" };

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const list = (v: unknown, max: number, n: number): string[] => {
  const arr = Array.isArray(v) ? v : typeof v === "string" ? v.split(/[,\n]/) : [];
  return Array.from(new Set(arr.map((x) => clean(x, max)).filter(Boolean))).slice(0, n);
};

/** Suggested ICP from the category preset + the business's own market. Null when nothing can be suggested honestly. */
export function defaultIcp(b: { primary_category: string | null; city: string | null; state: string | null }): Icp | null {
  const preset = icpFor(b.primary_category);
  const loc = b.city && b.state ? [`${b.city}, ${b.state}`] : b.city ? [b.city] : [];
  if (!preset && !loc.length) return null;
  return { industries: preset?.queries ?? [], locations: loc, size: "any", notes: preset ? `Suggested for a ${b.primary_category} business: ${preset.label}.` : null, source: "preset" };
}

/** "Tampa, FL, Orlando, FL" → ["Tampa, FL", "Orlando, FL"]: a bare two-letter state token joins the city before it (found live: the plain splitter searched "in FL"). */
export function parseLocations(v: unknown, n = 6): string[] {
  const raw = Array.isArray(v) ? v.flatMap((x) => String(x).split(/[,\n]/)) : typeof v === "string" ? v.split(/[,\n]/) : [];
  const toks = raw.map((x) => clean(x, 80)).filter(Boolean); const out: string[] = [];
  for (const t of toks) { if (/^[A-Za-z]{2}$/.test(t) && out.length && !/,\s*[A-Z]{2}$/.test(out[out.length - 1])) out[out.length - 1] = `${out[out.length - 1]}, ${t.toUpperCase()}`; else out.push(t); }
  return Array.from(new Set(out)).slice(0, n);
}

export function parseIcpInput(b: Record<string, unknown>): { error: string } | { icp: Icp } {
  const industries = list(b.industries, 60, 6);
  const locations = parseLocations(b.locations);
  const size = (ICP_SIZES.some((s) => s.key === b.size) ? b.size : "any") as IcpSize;
  if (!industries.length) return { error: "Name at least one kind of business you want more of (e.g. property management company)." };
  if (!locations.length) return { error: "Add at least one city or area (e.g. Tampa, FL)." };
  return { icp: { industries, locations, size, notes: clean(b.notes, 400) || null, source: "user" } };
}

/** Exa queries: one per industry × location, capped so a run stays cheap (≤ 6 searches). */
export function icpQueries(icp: Icp, max = 6): string[] {
  const out: string[] = [];
  for (const loc of icp.locations) for (const ind of icp.industries) { if (out.length >= max) return out; out.push(`${ind} in ${loc}`); }
  return out;
}

export const sizeLabel = (k: string | null | undefined) => ICP_SIZES.find((s) => s.key === k)?.label ?? "Any size";
