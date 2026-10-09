// SFB Agent program -- marketing + pricing configuration. Module STATUSES
// live in the database (agent_program_modules) because they change without
// a deploy; everything here changes rarely and ships with the code.

export type ModuleStatus = "live" | "unlocking_next" | "roadmap";

export const STATUS_LABEL: Record<ModuleStatus, string> = {
  live: "Live now",
  unlocking_next: "Unlocking next",
  roadmap: "On the roadmap",
};
export const STATUS_COLOR: Record<ModuleStatus, string> = { live: "#30D158", unlocking_next: "#FFD60A", roadmap: "#8E8E93" };

export const CREDIT_TIERS = [
  { level: "Low", credits: 1, examples: "Listing updates, review responses, report generation" },
  { level: "Medium", credits: 5, examples: "Ad creative, automation builds, landing pages" },
  { level: "High", credits: 25, examples: "Full website builds, campaign architecture" },
] as const;

export const TOP_UP_FROM_USD = 149;

export const AGENT_PLANS = [
  { key: "starter", name: "Starter", monthlyUsd: 1497, creditsPerMonth: 50, overseer: "Shared", onboardingUsd: 1497 },
  { key: "growth", name: "Growth", monthlyUsd: 2997, creditsPerMonth: 150, overseer: "Priority", onboardingUsd: 4497, featured: true },
  { key: "scale", name: "Scale", monthlyUsd: 4997, creditsPerMonth: 400, overseer: "Dedicated", onboardingUsd: 8997 },
] as const;

export const PRICING_NOTE = "Pricing shown for roofing. Clinics and private equity priced on consultation.";
export const DEMO_HREF = "/#book-a-demo";

export const AGENT_FAQ = [
  { q: "What exactly am I buying?", a: "An AI agent assigned to your business, plus the human who oversees it. It starts with AI presence and unlocks five more abilities over time. You watch it all from your SFB login." },
  { q: "When do the locked modules unlock?", a: "On our published roadmap — chat next, then CRM and automations, website, ads, and SOPs. You get a report with every unlock. Order can shift based on what customers ask for loudest." },
  { q: "What if I don't believe AI can do this?", a: "That's what the human overseer is for. Nothing customer-facing goes out without human approval, and every report is human-signed." },
  { q: "Do unused credits roll over?", a: "Monthly credits reset; top-up packs never expire while your membership is active." },
  { q: "Can I cancel?", a: "Monthly plans cancel anytime. Your data and reports stay exportable." },
] as const;

export const fmtUsd = (n: number) => `$${n.toLocaleString("en-US")}`;
