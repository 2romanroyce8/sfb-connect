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

// One real network attempt inside fetchPage() — a plain fetch is one
// attempt; a Facebook URL that gets blocked and then retried against
// mbasic.facebook.com is two. Recorded regardless of outcome so callers can
// derive facebook_fetch_result / mbasic_fallback_* without re-fetching or
// guessing from the final result alone.
export type FetchAttempt = {
  url: string;
  strategy: "direct" | "mbasic_fallback";
  ok: boolean;
  blockedReason?: string;
};

export type FetchedPage = {
  url: string; // as requested
  finalUrl: string; // after redirects
  ok: boolean;
  html: string;
  sourceType: string;
  blockedReason?: string;
  // Only populated for hosts fetchPage() has a multi-strategy path for
  // today (Facebook). Empty/undefined for every other host.
  fetchAttempts?: FetchAttempt[];
};

// facebook.com URL shape the seed actually was — this is what determines
// whether a business's identity can be recovered from the URL text alone
// when the page itself is blocked. "vanity" and "pages"/"people" carry a
// human-readable slug; "profile_id" (bare profile.php?id=NNNN) does not.
export type SeedUrlType = "vanity" | "profile_id" | "pages" | "people" | "website" | "other";

export type FetchOutcome = "success" | "blocked" | "failed" | "not_applicable";

// Per-job telemetry answering exactly the questions in the Facebook-recovery
// instrumentation request: did the direct fetch work, did mbasic save it,
// was identity recovered from the URL text vs. a secondary (wider-web)
// source, and how far did the graph actually get. Attached to every
// crm_research_jobs row, success or failure, so the failure/recovery rate
// can be measured at real volume instead of guessed at.
export type ResearchInstrumentation = {
  seedUrlType: SeedUrlType;
  facebookFetchResult: FetchOutcome;
  mbasicFallbackUsed: boolean;
  mbasicFallbackResult: FetchOutcome;
  identityRecoveredFromUrl: boolean;
  identityRecoveredFromSecondarySource: boolean;
  discoveryProviderUsed: string | null;
  sourcesVerified: number;
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
export type DiscoveryMethod = "seed" | "bio_link" | "link_extraction" | "social_link" | "website_crawl" | "gap_analysis" | "qa_reopen" | "search_discovery";

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
  // Honest record of whether independent wider-web website discovery ran
  // at all -- "discovery_unavailable" (no provider configured / not enough
  // identity to search) must never be collapsed into "not_found" (a real
  // search ran and found nothing). Optional/undefined for research results
  // created before this field existed.
  websiteDiscovery?: {
    status: "found" | "not_found" | "discovery_unavailable";
    provider: string | null;
    reason: string | null;
    queriesRun: string[];
  };
};
