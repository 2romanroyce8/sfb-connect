import type { BusinessGraph } from "./types";

export type ChecklistItem = { label: string; found: boolean; required: boolean };
export type CompletenessResult = {
  overallPercent: number;
  breakdown: { category: string; percent: number }[];
  checklist: ChecklistItem[];
};

function has(graph: BusinessGraph, type: string) {
  return graph.contactMethods.some((c) => c.type === type && c.status !== "not_found" && c.value);
}
function hasSocial(graph: BusinessGraph, platform: string) {
  return graph.socialProfiles.some((s) => s.platform === platform && s.status !== "not_found" && s.url);
}

// Research completeness is NOT the AI Presence score — it measures how much
// of the requested lead-intelligence checklist was actually verified, not
// how good the business's own web presence is.
export function evaluateCompleteness(graph: BusinessGraph): CompletenessResult {
  const identity: ChecklistItem[] = [
    { label: "Business Name", found: !!graph.businessName?.value, required: true },
    { label: "Category", found: !!graph.category, required: true },
  ];
  const contact: ChecklistItem[] = [
    { label: "Phone", found: has(graph, "phone"), required: true },
    { label: "Email", found: has(graph, "email"), required: true },
    { label: "Website", found: has(graph, "website"), required: true },
    { label: "WhatsApp", found: has(graph, "whatsapp"), required: true },
    { label: "Booking Link", found: has(graph, "booking"), required: false },
  ];
  const location: ChecklistItem[] = [
    { label: "Address", found: graph.locations.some((l) => l.locationType === "primary"), required: true },
    { label: "Service Areas", found: graph.locations.some((l) => l.locationType === "service_area"), required: true },
  ];
  const social: ChecklistItem[] = [
    { label: "Facebook", found: hasSocial(graph, "facebook"), required: true },
    { label: "Instagram", found: hasSocial(graph, "instagram"), required: true },
    { label: "TikTok", found: hasSocial(graph, "tiktok"), required: true },
    { label: "LinkedIn", found: hasSocial(graph, "linkedin"), required: false },
    { label: "YouTube", found: hasSocial(graph, "youtube"), required: false },
  ];
  const services: ChecklistItem[] = [
    { label: "Services", found: graph.services.length > 0, required: true },
    { label: "Owner / Contact", found: !!graph.ownerName, required: false },
    { label: "Review Signals", found: graph.signals.hasAggregateRating, required: false },
  ];

  function pct(items: ChecklistItem[]) {
    const required = items.filter((i) => i.required);
    if (required.length === 0) return 100;
    return Math.round((required.filter((i) => i.found).length / required.length) * 100);
  }

  const breakdown = [
    { category: "Identity", percent: pct(identity) },
    { category: "Contact", percent: pct(contact) },
    { category: "Location", percent: pct(location) },
    { category: "Social Profiles", percent: pct(social) },
    { category: "Services", percent: pct(services) },
  ];

  const overallPercent = Math.round(breakdown.reduce((s, b) => s + b.percent, 0) / breakdown.length);

  return { overallPercent, breakdown, checklist: [...identity, ...contact, ...location, ...social, ...services] };
}
