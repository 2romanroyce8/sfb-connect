// Fallback business-category classifier. JSON-LD `@type` is always the
// strongest signal (handled directly in LeadProfileBuilder at strength 3),
// but most small-business websites never publish schema.org markup at all —
// that gap is exactly why a real, crawled website could still leave
// "Category: Not found". This module scans title / meta description /
// headings / nav+footer link text for known service-category keywords and
// proposes a lower-strength candidate so `resolveField` has something to
// fall back on. Nothing here is AI-guessed — it's a fixed keyword lookup
// against real page text, same class of technique as the rest of the engine.
import type { Candidate, FetchedPage } from "./types";
import { extractTitle, extractMeta, extractHeadings, extractNavText } from "./htmlExtract";

type CategoryRule = { category: string; keywords: string[] };

const CATEGORY_RULES: CategoryRule[] = [
  { category: "Roofing Contractor", keywords: ["roofing", "roof repair", "roof replacement", "reroof", "shingle roof", "roofer"] },
  { category: "Plumbing Contractor", keywords: ["plumbing", "plumber", "drain cleaning", "water heater repair", "pipe repair"] },
  { category: "HVAC Contractor", keywords: ["hvac", "air conditioning repair", "heating and cooling", "furnace repair", "ac repair"] },
  { category: "Electrical Contractor", keywords: ["electrician", "electrical contractor", "panel upgrade", "electrical wiring"] },
  { category: "General Contractor", keywords: ["general contractor", "home remodeling", "renovation contractor", "construction company"] },
  { category: "Hauling & Junk Removal", keywords: ["junk removal", "hauling service", "dumpster rental", "debris removal"] },
  { category: "Landscaping", keywords: ["landscaping", "lawn care", "lawn maintenance", "tree service", "hardscape"] },
  { category: "Auto Repair", keywords: ["auto repair", "mechanic shop", "car repair", "transmission repair"] },
  { category: "Towing Service", keywords: ["towing service", "tow truck", "roadside assistance"] },
  { category: "Restaurant", keywords: ["restaurant", "our menu", "dine in", "order takeout", "make a reservation"] },
  { category: "Salon & Spa", keywords: ["hair salon", "day spa", "hair stylist", "nail salon", "barbershop"] },
  { category: "Cleaning Service", keywords: ["cleaning service", "house cleaning", "janitorial service", "maid service"] },
  { category: "Pest Control", keywords: ["pest control", "exterminator", "termite treatment"] },
  { category: "Real Estate", keywords: ["real estate agent", "realtor", "homes for sale", "property listings"] },
  { category: "Law Firm", keywords: ["law firm", "attorney at law", "personal injury lawyer", "legal services"] },
  { category: "Dental Practice", keywords: ["dentist", "dental care", "dental office", "orthodontist"] },
  { category: "Medical Practice", keywords: ["medical clinic", "family practice", "urgent care", "physician"] },
  { category: "Photography", keywords: ["photographer", "photography studio", "wedding photography"] },
  { category: "Fitness & Gym", keywords: ["gym membership", "fitness studio", "personal training", "crossfit"] },
  { category: "Moving Company", keywords: ["moving company", "professional movers", "relocation services"] },
  { category: "Pool Service", keywords: ["pool service", "pool cleaning", "pool maintenance", "pool repair"] },
  { category: "Painting Contractor", keywords: ["painting contractor", "house painters", "interior painting"] },
  { category: "Flooring Contractor", keywords: ["flooring installation", "hardwood installation", "carpet installation"] },
  { category: "Pressure Washing", keywords: ["pressure washing", "power washing", "soft washing"] },
  { category: "Locksmith", keywords: ["locksmith", "lock repair", "rekey service"] },
  { category: "Auto Detailing", keywords: ["auto detailing", "car detailing", "mobile detailing"] },
];

export function classifyCategoryHeuristic(pages: FetchedPage[]): Candidate<string> | null {
  const scores = new Map<string, { score: number; sourceUrl: string }>();

  for (const page of pages) {
    if (!page.ok) continue;
    const title = (extractTitle(page.html) || "").toLowerCase();
    const meta = (extractMeta(page.html, "description") || extractMeta(page.html, "og:description") || "").toLowerCase();
    const headings = extractHeadings(page.html).join(" ").toLowerCase();
    const nav = extractNavText(page.html).join(" ").toLowerCase();

    for (const rule of CATEGORY_RULES) {
      let hit = 0;
      for (const kw of rule.keywords) {
        if (title.includes(kw)) hit += 2;
        if (headings.includes(kw)) hit += 2;
        if (nav.includes(kw)) hit += 1;
        if (meta.includes(kw)) hit += 1;
      }
      if (hit > 0) {
        const prev = scores.get(rule.category);
        scores.set(rule.category, { score: (prev?.score || 0) + hit, sourceUrl: prev?.sourceUrl || page.finalUrl });
      }
    }
  }

  if (scores.size === 0) return null;
  const [topCategory, top] = Array.from(scores.entries()).sort((a, b) => b[1].score - a[1].score)[0];
  // Require at least a modest signal (two keyword hits) before proposing a
  // category — a single stray meta-description match is not enough evidence.
  if (top.score < 2) return null;

  return { value: topCategory, sourceUrl: top.sourceUrl, sourceType: "website", strength: 1 };
}
