import type { ResearchScope } from "./LeadProfileBuilder";
import { canonicalDomain } from "./normalize";

/**
 * AUTO scope detection (Research Spec §1). The user pastes a URL; we decide
 * the technical scope from the host so nobody has to understand five
 * engine modes. "Deep" and "Quick" remain as the only user-facing
 * overrides; the five technical scopes stay valid API values.
 */
export type DetectedScope = "SOCIAL_PROFILE" | "GOOGLE_BUSINESS" | "BIO_LINK_HUB" | "WEBSITE";
export type UserScopeOverride = "AUTO" | "DEEP" | "QUICK";

const SOCIAL_HOSTS = ["facebook.com", "fb.com", "m.facebook.com", "instagram.com", "tiktok.com", "x.com", "twitter.com", "youtube.com", "youtu.be", "linkedin.com", "threads.net", "pinterest.com"];
const GOOGLE_BUSINESS_HOSTS = ["maps.google.com", "google.com", "g.page", "goo.gl", "business.google.com", "maps.app.goo.gl"];
const BIO_HUB_HOSTS = ["linktr.ee", "beacons.ai", "bio.link", "lnk.bio", "campsite.bio", "linkin.bio", "solo.to", "carrd.co", "tap.bio", "stan.store"];

function hostMatches(domain: string, list: string[]): boolean {
  return list.some((h) => domain === h || domain.endsWith(`.${h}`));
}

export function detectScope(url: string): DetectedScope {
  const domain = (canonicalDomain(url) || "").toLowerCase();
  if (hostMatches(domain, SOCIAL_HOSTS)) return "SOCIAL_PROFILE";
  if (hostMatches(domain, GOOGLE_BUSINESS_HOSTS) && /maps|g\.page|goo\.gl|business\.google/.test(url.toLowerCase())) return "GOOGLE_BUSINESS";
  if (hostMatches(domain, BIO_HUB_HOSTS)) return "BIO_LINK_HUB";
  return "WEBSITE";
}

/** Maps the detected scope + user override onto the engine's existing
 * ResearchScope. QUICK always wins (user asked for narrow); otherwise the
 * detected scope picks the engine mode; DEEP is the default full graph. */
export function resolveEngineScope(detected: DetectedScope, override: UserScopeOverride): ResearchScope {
  if (override === "QUICK") return "quick_contact";
  switch (detected) {
    case "SOCIAL_PROFILE":
      return "social_profile";
    case "GOOGLE_BUSINESS":
      return "google_business";
    case "BIO_LINK_HUB":
      return "public_web"; // a hub's links are all first-party candidates -> full graph
    default:
      return "public_web";
  }
}

export const DETECTED_SCOPE_LABEL: Record<DetectedScope, string> = {
  SOCIAL_PROFILE: "Social profile",
  GOOGLE_BUSINESS: "Google Business",
  BIO_LINK_HUB: "Bio-link hub",
  WEBSITE: "Website",
};
