import type { CategoryResult } from "./audit";

export type Offer = "ai_presence" | "website_new" | "website_rebuild" | "bingled" | "no_clear_opportunity";

export type OpportunityResult = {
  primary: Offer;
  secondary: Offer | null;
  confidence: "high" | "medium" | "low";
  why: string[];
};

const OFFER_LABEL: Record<Offer, string> = {
  ai_presence: "AI Presence",
  website_new: "New Website",
  website_rebuild: "Website Rebuild",
  bingled: "Bingled",
  no_clear_opportunity: "No Clear Opportunity",
};

export { OFFER_LABEL };

function byCategory(categories: CategoryResult[]) {
  const map: Record<string, CategoryResult> = {};
  for (const c of categories) map[c.category] = c;
  return map;
}

// Deterministic offer selection — every branch is explainable from the same
// category evidence the audit produced. No model call decides the offer.
export function generateOpportunity(categories: CategoryResult[], hasWebsite: boolean): OpportunityResult {
  const cat = byCategory(categories);
  const overall = categories.reduce((s, c) => s + c.score, 0);

  if (!hasWebsite) {
    return {
      primary: "website_new",
      secondary: overall > 30 ? "ai_presence" : null,
      confidence: "high",
      why: [
        "No functioning business website was found among the supplied sources",
        ...(cat["identity"]?.positive_evidence || []),
      ],
    };
  }

  if (overall >= 85) {
    return {
      primary: "no_clear_opportunity",
      secondary: null,
      confidence: "high",
      why: ["This business already scores strongly across identity, knowledge, authority, location, and machine readability"],
    };
  }

  const identity = cat["identity"]?.score ?? 0;
  const knowledge = cat["knowledge"]?.score ?? 0;
  const authority = cat["authority"]?.score ?? 0;
  const location = cat["location"]?.score ?? 0;
  const machine = cat["machine_readability"]?.score ?? 0;

  // Site exists but communicates almost nothing about the business at all —
  // that's a build/rebuild problem, not an optimization problem.
  if (identity <= 5 && knowledge <= 5) {
    return {
      primary: "website_rebuild",
      secondary: "ai_presence",
      confidence: identity === 0 && knowledge === 0 ? "high" : "medium",
      why: [
        ...(cat["identity"]?.unknowns || []),
        ...(cat["knowledge"]?.negative_evidence || []),
        "The existing website isn't communicating clear, machine-readable business information",
      ],
    };
  }

  // Core site content is fine, but discovery/authority is the real gap and
  // the business is clearly local — Bingled fits better than another
  // website pass.
  if (authority < 10 && location >= 10 && identity + knowledge + machine >= 35) {
    return {
      primary: "bingled",
      secondary: "ai_presence",
      confidence: authority === 0 ? "high" : "medium",
      why: [
        ...(cat["authority"]?.negative_evidence || []),
        ...(cat["authority"]?.unknowns || []),
        "Location and core site information are in decent shape — the gap is external discovery signals",
      ],
    };
  }

  // Default: the site exists and covers the basics, but AI systems can't
  // parse it well — this is exactly what AI Presence is built to fix.
  return {
    primary: "ai_presence",
    secondary: authority < 10 ? "bingled" : null,
    confidence: knowledge + machine <= 15 ? "high" : "medium",
    why: [
      ...(cat["machine_readability"]?.negative_evidence || []),
      ...(cat["knowledge"]?.negative_evidence || []),
      ...(cat["identity"]?.negative_evidence || []),
    ].slice(0, 4),
  };
}
