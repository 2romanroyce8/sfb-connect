// Shared vocabulary for the Research Engine V2. Every discovered fact in the
// business graph carries this same status/confidence shape, whether it's a
// contact method, a location, or a social profile.

export type FieldStatus = "verified" | "uncertain" | "not_found" | "conflict";

export type SourceCheck = {
  sourceUrl: string;
  sourceType: string;
  reachable: boolean;
  reason?: string; // e.g. "login wall", "timeout", "blocked" — only set when reachable=false
};

export type FetchedPage = {
  url: string; // as requested
  finalUrl: string; // after redirects
  ok: boolean;
  html: string;
  sourceType: string;
  blockedReason?: string;
};

export type Candidate<T = string> = {
  value: T;
  sourceUrl: string;
  sourceType: string;
  strength: number; // 1 = weak/secondary, 2 = structured secondary, 3 = official site / structured data
};

export type ContactMethodType = "phone" | "email" | "website" | "whatsapp" | "booking" | "contact_form";
export type SocialPlatform = "facebook" | "instagram" | "tiktok" | "linkedin" | "youtube" | "x" | "whatsapp";
export type LocationType = "primary" | "branch" | "service_area" | "tagged_location" | "mentioned_location" | "uncertain";

export type ContactMethodRecord = {
  type: ContactMethodType;
  value: string | null;
  status: FieldStatus;
  confidence: number;
  sourceUrl: string | null;
};

export type SocialProfileRecord = {
  platform: SocialPlatform;
  handle: string | null;
  url: string | null;
  displayName: string | null;
  status: FieldStatus;
  confidence: number;
  sourceUrl: string | null;
};

export type LocationRecord = {
  name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  locationType: LocationType;
  status: FieldStatus;
  confidence: number;
  sourceUrl: string | null;
};

// One row per source the Discovery Graph ever touched — this is what lets
// the owner inspect exactly which extraction step failed when a rep reports
// a missed Linktree/website/social. discoveryMethod distinguishes "we found
// this by reading another page" from "the rep pasted this directly".
export type DiscoveryMethod = "seed" | "bio_link" | "link_extraction" | "social_link" | "website_crawl" | "gap_analysis" | "qa_reopen";

export type SourceLogEntry = {
  url: string;
  sourceType: string;
  discoveredFrom: string | null;
  discoveryMethod: DiscoveryMethod;
  fetchStatus: "ok" | "unavailable";
  blockedReason?: string;
  primaryPassDone: boolean;
  verificationPassDone: boolean;
};

export type QAPassResult = {
  pass: number;
  name: string;
  passed: boolean;
  issues: string[];
  newSourcesFound: number;
};

export type BusinessGraph = {
  businessName: Candidate | null;
  category: string | null;
  description: string | null;
  services: string[];
  ownerName: string | null;
  contactMethods: ContactMethodRecord[];
  locations: LocationRecord[];
  socialProfiles: SocialProfileRecord[];
  sourceChecks: SourceCheck[];
  // Full discovery-graph audit trail + QA pass results, surfaced to the
  // owner in the Research Results UI so a missed source is debuggable
  // instead of a silent gap.
  sourceLog: SourceLogEntry[];
  qaResults: QAPassResult[];
  // Backward-compatible flat signals the deterministic audit scorer reads.
  signals: {
    hasJsonLd: boolean;
    hasHttps: boolean;
    hasMetaDescription: boolean;
    hasAggregateRating: boolean;
  };
};
