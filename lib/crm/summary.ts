import type { CategoryResult } from "./audit";

export type BusinessSummary = {
  narrative: string;
  strong: string[];
  middle: string[];
  weak: string[];
  unknown: string[];
};

const CATEGORY_LABEL: Record<string, string> = {
  identity: "business identity",
  knowledge: "business information",
  authority: "external authority",
  location: "location information",
  machine_readability: "machine readability",
};

// Rep-readable summary composed entirely from the deterministic category
// results — never a raw dump of technical audit fields, but also never a
// claim that isn't already backed by one of those categories.
export function generateBusinessSummary(
  businessName: string | null,
  category: string | null,
  city: string | null,
  categories: CategoryResult[]
): BusinessSummary {
  const name = businessName || "This business";
  const kind = category ? category.toLowerCase() : "business";
  const location = city ? ` serving the ${city} area` : "";

  const overall = categories.reduce((s, c) => s + c.score, 0);
  const strongCats = categories.filter((c) => c.score >= 15);
  const weakCats = categories.filter((c) => c.score <= 5);
  const midCats = categories.filter((c) => c.score > 5 && c.score < 15);

  let posture: string;
  if (overall >= 70) posture = "has a solid AI-visible presence with a few gaps worth closing";
  else if (overall >= 40) posture = "has a mixed AI presence — some signals are clear, others are missing or unconfirmed";
  else posture = "has significant gaps in how AI systems can find and understand it";

  const narrative = `${name} appears to be a ${kind}${location}. Based on the sources reviewed, it ${posture}.`;

  return {
    narrative,
    strong: strongCats.flatMap((c) => c.positive_evidence),
    middle: midCats.flatMap((c) => [...c.positive_evidence, ...c.negative_evidence]),
    weak: weakCats.flatMap((c) => c.negative_evidence),
    unknown: categories.flatMap((c) => c.unknowns),
  };
}

export { CATEGORY_LABEL };
