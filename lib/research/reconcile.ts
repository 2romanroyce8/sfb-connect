import type { BusinessGraph, Candidate, ContactMethodRecord, LocationRecord, SocialProfileRecord, SourceLogEntry } from "./types";
import { canonicalDomain, classifyLink, isSocialProfilePath } from "./normalize";
import type { EntityMatchStatus } from "./entityMatch";
import { normalizeName as normalizeSeedName, urlNamesSeed } from "./entityMatch";

// ============================================================
// ENTITY RECONCILIATION LAYER (Research Spec §2-§7, §10)
//
// Pure functions over the BusinessGraph the V4 engine already produces.
// Nothing here fetches; nothing here invents. This turns "a bag of
// candidates with statuses" into one source-backed ResearchProfile with
// explicit identity confidence, per-field sources, conflicts, limitations,
// and a deterministic Research Confidence %.
//
// Core rule (mandatory): NEVER SACRIFICE IDENTITY ACCURACY FOR
// COMPLETENESS. Anything that can't be tied to the seed business with
// sufficient evidence stays UNCERTAIN / INFERRED -- it is never promoted.
// ============================================================

export type FieldStatus = "CONFIRMED" | "UNCERTAIN" | "NOT_FOUND" | "CONFLICT" | "INACCESSIBLE" | "INFERRED";
export type Confidence = "HIGH" | "MEDIUM" | "LOW";
export type IdentityConfidence = "confirmed" | "uncertain" | "conflict" | "not_found";
export type ProfileType = "BUSINESS_PAGE" | "CREATOR" | "PUBLIC_PROFILE" | "PERSONAL_PROFILE" | "GROUP" | "EVENT" | "UNKNOWN";

// ---- Entity relationship layer ----
// A Facebook personal profile is a SOURCE TYPE, never an identity verdict.
// The engine answers "who is this account, what does it represent, and is
// there a business connected to it?" -- not "is this a Facebook Page?".
export type SourceType =
  | "FACEBOOK_PAGE" | "FACEBOOK_PERSONAL_PROFILE" | "FACEBOOK_PROFESSIONAL_PROFILE" | "FACEBOOK_GROUP" | "FACEBOOK_EVENT" | "FACEBOOK_UNKNOWN"
  | "INSTAGRAM_BUSINESS_ACCOUNT" | "INSTAGRAM_PERSONAL_ACCOUNT" | "INSTAGRAM_CREATOR_ACCOUNT" | "INSTAGRAM_UNKNOWN"
  | "LINKEDIN_PERSON_PROFILE" | "LINKEDIN_COMPANY_PAGE" | "LINKEDIN_ORGANIZATION_PAGE" | "LINKEDIN_UNKNOWN"
  | "X_PROFILE" | "X_BUSINESS_PROFILE" | "X_CREATOR_PROFILE" | "X_UNKNOWN"
  | "TIKTOK_PERSONAL_ACCOUNT" | "TIKTOK_BUSINESS_ACCOUNT" | "TIKTOK_CREATOR_ACCOUNT" | "TIKTOK_UNKNOWN"
  | "WEBSITE" | "INSTAGRAM" | "TIKTOK" | "YOUTUBE" | "LINKEDIN" | "X" | "GOOGLE_BUSINESS" | "BIO_LINK_HUB" | "OTHER";
export type EntityType = "PERSON" | "BUSINESS" | "PERSON_OPERATING_BUSINESS" | "CREATOR" | "ORGANIZATION" | "UNKNOWN";
export type BusinessStatus = "BUSINESS" | "PERSON_OPERATING_BUSINESS" | "PERSON_ASSOCIATED_WITH_BUSINESS" | "BUSINESS_IDENTITY_UNCERTAIN" | "NO_BUSINESS_IDENTIFIED";
export type RelationshipType = "OWNER" | "FOUNDER" | "COFOUNDER" | "CEO" | "OPERATOR" | "REPRESENTATIVE" | "EMPLOYEE" | "CONSULTANT" | "CREATOR" | "ASSOCIATED" | "UNKNOWN";
/** Roles that mean the person RUNS the business (-> PERSON_OPERATING_BUSINESS).
 * An employer field or a representative title never implies ownership. */
export const OPERATING_ROLES: ReadonlySet<RelationshipType> = new Set<RelationshipType>(["OWNER", "FOUNDER", "COFOUNDER", "CEO", "OPERATOR"]);
export type RelationshipBasis = "corroborated" | "self_described" | "inferred";

export type PersonEntity = {
  name: string;
  facebookUrl: string | null;
  facebookUsername: string | null;
  bio: string | null;
  publicLocation: string | null;
  role: RelationshipType | null;
  confidence: Confidence;
  sources: SourceRef[];
};
export type BusinessEntity = {
  name: string | null;
  candidates: { value: string; sources: SourceRef[]; strength: number }[];
  status: FieldStatus;
  confidence: Confidence;
};
export type EntityRelationship = {
  relationshipType: RelationshipType;
  basis: RelationshipBasis;
  confidence: Confidence;
  evidence: SourceRef[];
  explanation: string[];
};
export type BusinessSignal = { signal: string; detail: string; sourceUrl: string | null };
export type EntityModel = {
  sourceType: SourceType;
  sourceTypeBasis: "url" | "page_text" | "inferred";
  entityType: EntityType;
  businessStatus: BusinessStatus;
  person: PersonEntity | null;
  business: BusinessEntity | null;
  relationship: EntityRelationship | null;
  businessSignals: BusinessSignal[];
  notes: string[];
};
export type Association = "confirmed_first_party" | "likely_first_party" | "uncertain" | "rejected_unrelated" | "not_applicable";

export type SourceRef = { url: string; platform: string; observedAt: string; excerpt?: string | null };

export type FieldValue<T = string> = {
  value: T | null;
  status: FieldStatus;
  confidence: Confidence;
  sources: SourceRef[];
  conflicts?: { value: T; sources: SourceRef[] }[];
};

export type PhoneValue = FieldValue<string> & { normalized: string | null; kind: "business" | "mobile" | "fax" | "unknown" };

export type SourceEntity = {
  ordinal: number;
  url: string;
  canonicalUrl: string | null;
  platform: string;
  linkType: string;
  priority: 0 | 1 | 2 | 3;
  isFirstParty: boolean;
  association: Association;
  discoveredFromOrdinal: number | null;
  discoveryMethod: string;
  depth: number | null;
  fetchStatus: "fetched" | "indexed_public" | "blocked_login_wall" | "unreachable" | "skipped_priority" | "skipped_budget" | "generic_platform_shell" | "not_attempted";
  skipReason: string | null;
  profileType: ProfileType | null;
  linksToSeed: boolean;
  // Verdict of the entity matcher against the locked seed, with reasons.
  entityMatch: EntityMatchStatus;
  entityMatchReasons: string[];
  sourceEntityName: string | null;
  sourceQuality: "PRIMARY" | "VERIFIED" | "CORROBORATING" | "WEAK" | "IRRELEVANT";
};

export type Conflict = { field: string; values: { value: string; sources: SourceRef[] }[]; note: string };
export type Limitation = { code: string; message: string };

export type ResearchProfile = {
  identity: {
    businessName: FieldValue<string>;
    displayNames: { value: string; sources: SourceRef[] }[];
    profileType: ProfileType;
    category: FieldValue<string>;
    description: FieldValue<string>;
    identityConfidence: IdentityConfidence;
    identityNotes: string[];
  };
  contacts: {
    phones: PhoneValue[];
    emails: FieldValue<string>[];
    channels: { kind: string; value: string; sources: SourceRef[] }[];
  };
  locations: { physical: LocationRecord[]; serviceArea: LocationRecord[] };
  website: FieldValue<string>;
  socialProfiles: (SocialProfileRecord & { association: Association })[];
  business: { services: string[]; pricing: { note: "NO_PUBLIC_PRICING_FOUND" } };
  sources: SourceEntity[];
  conflicts: Conflict[];
  limitations: Limitation[];
  metrics: { researchConfidencePct: number; fieldsVerified: number; fieldsTotal: number; sourcesChecked: number; sourcesFetched: number; researchStatus: "complete" | "completed_with_limitations" };
  entities: EntityModel;
  seed: BusinessGraph["seedEntity"] | null;
  salesIntelligence: SalesIntelligence;
};

export type SalesIntelligence = {
  summary: string;
  whatTheyDo: string[];
  howTheySell: string[];
  contactMethods: string[];
  onlineStrengths: string[];
  onlineWeaknesses: string[];
  bestContactChannel: string | null;
  callPrep: string[];
};

// ---------- helpers ----------

export function normalizePhoneE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return null;
}

export function normalizeBusinessName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&amp;/g, "&")
    .replace(/\b(llc|inc|co|corp|corporation|company|ltd|the)\b\.?/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function ref(sourceUrl: string | null, excerpt?: string | null): SourceRef {
  return { url: sourceUrl || "unknown", platform: platformOf(sourceUrl || ""), observedAt: new Date().toISOString(), excerpt: excerpt ?? null };
}

export function platformOf(url: string): string {
  const d = (canonicalDomain(url) || "").toLowerCase();
  if (!d) return "unknown";
  if (d.endsWith("facebook.com") || d === "fb.com") return "facebook";
  if (d.endsWith("instagram.com")) return "instagram";
  if (d.endsWith("tiktok.com")) return "tiktok";
  if (d.endsWith("youtube.com") || d === "youtu.be") return "youtube";
  if (d.endsWith("linkedin.com")) return "linkedin";
  if (d === "x.com" || d.endsWith("twitter.com")) return "x";
  if (d === "wa.me" || d.endsWith("whatsapp.com")) return "whatsapp";
  if (d.includes("google.")) return "google_business";
  if (d.endsWith("yelp.com")) return "yelp";
  if (d.endsWith("bbb.org")) return "bbb";
  if (["linktr.ee", "beacons.ai", "bio.link", "lnk.bio"].includes(d)) return "bio_link_hub";
  return "website";
}

const TRADE_TOKENS = /\b(llc|inc|co|corp|company|services?|removal|hauling|junk|roofing|hvac|plumbing|cleaning|landscap\w*|lawn|repair|construction|contract\w*|remodel\w*|auto|towing|detailing|salon|barber|studio|shop|store|boutique|cafe|restaurant|bar|grill|catering|bakery|dental|law|legal|realty|real estate|photography|fitness|gym|pressure wash\w*|window|pest|moving|movers|electric\w*|painting|flooring|tile|fence|concrete|handyman|notary|insurance|tax|accounting|consulting|marketing|design|agency|group|solutions|enterprises?|logistics|transport\w*|trucking|dumpster|disposal|recycling)\b/i;
const ROLE_TOKENS: { re: RegExp; role: RelationshipType }[] = [
  { re: /\b(owner|proprietor|owner[- ]operator)\b/i, role: "OWNER" },
  { re: /\b(co-?founder|cofounder)\b/i, role: "COFOUNDER" },
  { re: /\b(founder|founded)\b/i, role: "FOUNDER" },
  { re: /\b(ceo|chief executive|president|managing director|principal)\b/i, role: "CEO" },
  { re: /\b(operator|operating|run(?:s|ning)? (?:my|our|a) (?:own )?business)\b/i, role: "OPERATOR" },
  { re: /\b(consultant|advisor|freelance\w*|contractor)\b/i, role: "CONSULTANT" },
  { re: /\b(creator|content creator|influencer|youtuber|streamer)\b/i, role: "CREATOR" },
  { re: /\b(manager|director|general manager|gm|vp|vice president|head of|lead)\b/i, role: "REPRESENTATIVE" },
  { re: /\b(sales|representative|rep|agent|realtor|broker|partner at)\b/i, role: "REPRESENTATIVE" },
  { re: /\b(works? at|working at|employee|technician|driver|crew|associate|specialist|engineer|designer|analyst|coordinator)\b/i, role: "EMPLOYEE" },
];
const CTA_TOKENS = /\b(call|text|book(?:ing)?|schedule|free (?:estimate|quote)s?|licensed|insured|serving|we (?:offer|provide|specialize)|dm (?:for|to)|message (?:for|to) (?:book|quote|pricing)|same[- ]day|24\/7|open (?:mon|tue|wed|thu|fri|sat|sun|daily))\b/i;

/** Legacy adapter kept for callers/tests that still read identity.profileType. */
export function detectFacebookProfileType(seedUrl: string, businessName: string | null): ProfileType {
  const st = classifyFacebookSourceType(seedUrl, null, businessName);
  switch (st.sourceType) {
    case "FACEBOOK_GROUP": return "GROUP";
    case "FACEBOOK_EVENT": return "EVENT";
    case "FACEBOOK_PAGE": return "BUSINESS_PAGE";
    case "FACEBOOK_PERSONAL_PROFILE": return businessName && TRADE_TOKENS.test(businessName) ? "PUBLIC_PROFILE" : "PERSONAL_PROFILE";
    case "FACEBOOK_PROFESSIONAL_PROFILE": return "PUBLIC_PROFILE";
    case "FACEBOOK_UNKNOWN": return "BUSINESS_PAGE";
    default: return "UNKNOWN";
  }
}

/** Source-type classification. URL shape first; then the seed page's own
 * og:description, which on Facebook is a reliable tell: personal profiles
 * read "<Name> is on Facebook. Join Facebook to connect with <Name>..."
 * while Pages read "<Name>. 1,234 likes · 12 talking about this. <about>".
 * Vanity URLs with neither signal stay FACEBOOK_UNKNOWN -- we don't guess. */
export function classifyFacebookSourceType(seedUrl: string, seedDescription: string | null, seedDisplayName: string | null, seedFlags?: { business?: boolean; verified?: boolean; organization?: boolean; seller?: boolean; private?: boolean } | null): { sourceType: SourceType; basis: "url" | "page_text" | "inferred" } {
  const u = seedUrl.toLowerCase();
  const platform = platformOf(seedUrl);
  const flags = seedFlags ?? {};
  const text = seedDescription ?? "";
  const businessyText = TRADE_TOKENS.test(text) || CTA_TOKENS.test(text) || (seedDisplayName ? TRADE_TOKENS.test(seedDisplayName) : false);
  const roleyText = ROLE_TOKENS.some((r) => r.re.test(text));
  const personName = !!seedDisplayName && looksLikePersonName(seedDisplayName);
  if (platform === "tiktok") {
    // TikTok publishes real flags in its hydration JSON (commerceUser / isOrganization).
    if (flags.business || flags.organization) return { sourceType: "TIKTOK_BUSINESS_ACCOUNT", basis: "page_text" };
    if (personName && (roleyText || businessyText)) return { sourceType: "TIKTOK_CREATOR_ACCOUNT", basis: "inferred" };
    if (personName) return { sourceType: "TIKTOK_PERSONAL_ACCOUNT", basis: "inferred" };
    return { sourceType: "TIKTOK_UNKNOWN", basis: "inferred" };
  }
  if (platform === "x") {
    // X publishes display name, handle and bio only; no account-type flag.
    if (personName && (roleyText || businessyText)) return { sourceType: "X_CREATOR_PROFILE", basis: "inferred" };
    if (personName) return { sourceType: "X_PROFILE", basis: "inferred" };
    if (businessyText || (seedDisplayName && !personName)) return { sourceType: "X_BUSINESS_PROFILE", basis: "inferred" };
    return { sourceType: "X_UNKNOWN", basis: "inferred" };
  }
  if (platform === "linkedin") {
    // URL shape is authoritative on LinkedIn.
    if (/\/company\/|\/showcase\//.test(u)) return { sourceType: "LINKEDIN_COMPANY_PAGE", basis: "url" };
    if (/\/school\//.test(u)) return { sourceType: "LINKEDIN_ORGANIZATION_PAGE", basis: "url" };
    if (/\/in\//.test(u)) return { sourceType: "LINKEDIN_PERSON_PROFILE", basis: "url" };
    return { sourceType: "LINKEDIN_UNKNOWN", basis: "url" };
  }
  if (platform === "instagram") {
    // Instagram publishes no public account-type flag we can read without a
    // session, so this is always an inference from the account's own public
    // text: trade/role/CTA language -> business; person-shaped display name
    // with none of that -> personal. Otherwise honestly UNKNOWN.
    if (personName) return { sourceType: "INSTAGRAM_PERSONAL_ACCOUNT", basis: "inferred" };
    if (businessyText) return { sourceType: "INSTAGRAM_BUSINESS_ACCOUNT", basis: "inferred" };
    return { sourceType: "INSTAGRAM_UNKNOWN", basis: "inferred" };
  }
  if (platform !== "facebook") {
    const map: Record<string, SourceType> = { tiktok: "TIKTOK", youtube: "YOUTUBE", linkedin: "LINKEDIN", x: "X", google_business: "GOOGLE_BUSINESS", bio_link_hub: "BIO_LINK_HUB", website: "WEBSITE" };
    return { sourceType: map[platform] ?? "OTHER", basis: "url" };
  }
  if (/\/groups\//.test(u)) return { sourceType: "FACEBOOK_GROUP", basis: "url" };
  if (/\/events\//.test(u)) return { sourceType: "FACEBOOK_EVENT", basis: "url" };
  if (/\/pages\//.test(u)) return { sourceType: "FACEBOOK_PAGE", basis: "url" };
  const desc = seedDescription ?? "";
  if (/\bis on facebook\b|join facebook to connect with/i.test(desc)) {
    // Professional mode shows a category/role line in the intro; a trade or
    // role token in the bio text is the only public tell we have.
    const professional = TRADE_TOKENS.test(desc.replace(/join facebook.*$/i, "")) || ROLE_TOKENS.some((r) => r.re.test(desc));
    return { sourceType: professional ? "FACEBOOK_PROFESSIONAL_PROFILE" : "FACEBOOK_PERSONAL_PROFILE", basis: "page_text" };
  }
  if (/\d[\d,.]*\s*(likes|followers)|talking about this|were here|check-ins/i.test(desc)) return { sourceType: "FACEBOOK_PAGE", basis: "page_text" };
  if (/\/people\//.test(u) || /profile\.php\?id=/.test(u)) return { sourceType: "FACEBOOK_PERSONAL_PROFILE", basis: "url" };
  return { sourceType: "FACEBOOK_UNKNOWN", basis: "inferred" };
}

/** Platform-agnostic alias -- the function classifies every supported platform. */
export const classifySeedSourceType = classifyFacebookSourceType;

function cleanDisplayName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.replace(/\s*[|–—-]\s*facebook\s*$/i, "").replace(/\s*\|\s*.*$/, "").replace(/\s+/g, " ").trim();
  if (!v || /^facebook$/i.test(v) || /log in|sign up/i.test(v)) return null;
  return v;
}

/** "First Last" / "First M. Last" with no trade token -- a shape test, used
 * only for seeds already known to be profiles (never to decide page-ness). */
export function looksLikePersonName(name: string | null): boolean {
  if (!name) return false;
  const n = name.trim();
  if (TRADE_TOKENS.test(n)) return false;
  if (/[&@#\d]/.test(n)) return false;
  const words = n.split(/\s+/);
  if (words.length < 2 || words.length > 4) return false;
  return words.every((w) => /^[A-Z][a-z'’.-]*$|^[A-Z]\.$|^(de|van|von|da|del|la|le|bin|al)$/.test(w));
}

function extractBusinessMentionsFromBio(bio: string): { name: string; role: RelationshipType | null; excerpt: string }[] {
  const out: { name: string; role: RelationshipType | null; excerpt: string }[] = [];
  const text = bio.replace(/join facebook to connect with.*$/i, "").replace(/\s+/g, " ").trim();
  // "Owner of Smith's Junk Removal", "Founder @ Acme LLC", "CEO at Jones Auto Group"
  const roleRe = /\b(owner|proprietor|founder|co-?founder|cofounder|ceo|president|managing director|operator|manager|director|general manager|vp|sales|agent|realtor|consultant|advisor|creator)\s*(?:of|at|@|-|–|\||for|,)\s*([A-Z0-9][\w&'’.?!\-]*(?:\s+[A-Za-z0-9&'’.?!\-]+){0,6})/g;
  let m: RegExpExecArray | null;
  while ((m = roleRe.exec(text))) {
    const raw = m[2].replace(/[.,;:]+$/, "").replace(/\s+(serving|in|call|text|book|located|based|since|licensed|insured)\b.*$/i, "").trim();
    const role = ROLE_TOKENS.find((r) => r.re.test(m![1]))?.role ?? null;
    for (const name of raw.split(/\s+(?:&|and)\s+/).map((x) => x.trim())) {
      if (name.length >= 3 && !isGenericServicePhrase(name)) out.push({ name, role, excerpt: m[0] });
    }
  }
  // Bare trade-token business names: "Smith's Junk Removal LLC", "Elite Pressure Washing"
  const tradeRe = /\b((?:[A-Z][\w'’&.-]*\s+){0,4}[A-Z]?[\w'’&.-]*(?:LLC|Inc\.?|Co\.?|Corp\.?|Services?|Removal|Hauling|Cleaning|Roofing|Plumbing|HVAC|Landscaping|Construction|Realty|Photography|Studio|Salon|Auto|Repair|Detailing|Towing|Movers|Moving|Dumpsters?|Disposal|Pressure Washing|Lawn Care|Electric|Painting|Flooring|Fencing|Concrete|Handyman|Catering|Bakery|Fitness|Agency|Solutions|Enterprises?|Logistics|Trucking|Transport))\b/g;
  while ((m = tradeRe.exec(text))) {
    const name = m[1].trim();
    if (name.split(/\s+/).length >= 2 && !isGenericServicePhrase(name) && !out.some((o) => normalizeBusinessName(o.name) === normalizeBusinessName(name))) out.push({ name, role: null, excerpt: m[0] });
  }
  return out;
}

// Words that describe what a business DOES, not what it is CALLED. A bio
// fragment made only of these ("Commercial Junk Removal", "Residential
// Cleaning Services") is a service description, never a business name --
// observed live on the first Page run after the entity layer shipped.
const GENERIC_NAME_WORDS = new Set(["residential", "commercial", "industrial", "local", "professional", "affordable", "quality", "premium", "reliable", "licensed", "insured", "full", "service", "services", "junk", "removal", "hauling", "cleaning", "roofing", "plumbing", "hvac", "landscaping", "lawn", "care", "construction", "repair", "repairs", "auto", "detailing", "towing", "moving", "movers", "dumpster", "dumpsters", "disposal", "pressure", "washing", "electric", "electrical", "painting", "flooring", "fencing", "concrete", "handyman", "catering", "bakery", "fitness", "photography", "and", "&", "the", "of", "for", "in", "serving", "area", "areas", "llc", "inc", "co", "company"]);
export function isGenericServicePhrase(name: string): boolean {
  const words = name.toLowerCase().replace(/[^a-z&\s]/g, " ").split(/\s+/).filter(Boolean);
  return words.length > 0 && words.every((w) => GENERIC_NAME_WORDS.has(w));
}

/** Decodes the numeric/hex HTML entities Facebook leaves in og text
 * ("&#xb7;" middle dot, "&#x1f40d;" emoji) plus the common named ones. */
export function decodeHtmlText(input: string | null | undefined): string | null {
  if (!input) return input ?? null;
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => { try { return String.fromCodePoint(parseInt(h, 16)); } catch { return ""; } })
    .replace(/&#(\d+);/g, (_, d) => { try { return String.fromCodePoint(parseInt(d, 10)); } catch { return ""; } })
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");
}

function humanizeDomain(domain: string): string {
  return domain.replace(/\.(com|net|org|co|us|biz|io|llc|services)$/i, "").replace(/[-_]/g, " ");
}

export function analyzeEntities(
  graph: BusinessGraph,
  seedUrl: string,
  website: FieldValue<string>,
  phones: PhoneValue[],
  emails: FieldValue<string>[],
  channels: { kind: string; value: string }[],
  socialProfiles: (SocialProfileRecord & { association: Association })[],
  firstPartyUrls: Set<string>
): { entities: EntityModel; identityConfidence: IdentityConfidence; identityStatus: FieldStatus; notes: string[]; conflicts: Conflict[] } {
  const notes: string[] = [];
  const conflicts: Conflict[] = [];
  const seedMeta = graph.pageMeta?.find((p) => p.isSeed) ?? null;
  const seedDisplayName = cleanDisplayName(decodeHtmlText(seedMeta?.ogTitle ?? seedMeta?.title ?? (graph.businessName?.sourceUrl === seedUrl ? graph.businessName.value : null)));
  const seedBio = decodeHtmlText(seedMeta?.description ?? (graph.pageMeta ? null : graph.description)); // legacy graphs: description was the first page's meta
  const { sourceType, basis } = classifyFacebookSourceType(seedUrl, seedBio, seedDisplayName, seedMeta?.accountFlags ?? null);
  const PROFILE_SOURCE_TYPES: ReadonlySet<SourceType> = new Set<SourceType>(["FACEBOOK_PERSONAL_PROFILE", "FACEBOOK_PROFESSIONAL_PROFILE", "INSTAGRAM_PERSONAL_ACCOUNT", "LINKEDIN_PERSON_PROFILE", "X_PROFILE", "X_CREATOR_PROFILE", "TIKTOK_PERSONAL_ACCOUNT", "TIKTOK_CREATOR_ACCOUNT"]);
  const UNKNOWN_SOURCE_TYPES: ReadonlySet<SourceType> = new Set<SourceType>(["FACEBOOK_UNKNOWN", "INSTAGRAM_UNKNOWN", "X_UNKNOWN", "TIKTOK_UNKNOWN", "LINKEDIN_UNKNOWN"]);
  const isProfileSeed = PROFILE_SOURCE_TYPES.has(sourceType) || (UNKNOWN_SOURCE_TYPES.has(sourceType) && looksLikePersonName(seedDisplayName));
  const isOrgSeed = sourceType === "LINKEDIN_COMPANY_PAGE" || sourceType === "LINKEDIN_ORGANIZATION_PAGE" || sourceType === "TIKTOK_BUSINESS_ACCOUNT" || sourceType === "FACEBOOK_PAGE";
  const platformName = sourceType.split("_")[0].toLowerCase();
  const seedHandle = (() => { try { const u = new URL(seedUrl); const seg = u.pathname.split("/").filter(Boolean)[0]; return seg ? seg.replace(/^@/, "") : null; } catch { return null; } })();
  // Pages that link back to the exact seed account are tied to the entity by
  // the entity itself -- strongest corroboration there is.
  const seedPlatform = platformOf(seedUrl);
  const backlinkUrls = new Set((graph.pageMeta ?? []).filter((m) => m.linksToSeed && platformOf(m.url) !== seedPlatform).map((m) => m.url));
  const officialDomain = website.value ? (canonicalDomain(website.value) || "").toLowerCase() : "";
  const seedRef = (excerpt?: string | null) => ref(seedUrl, excerpt);

  // ---- business name candidates, source by source (never collapsed) ----
  // eligible = may become THE business. A name found on some page the graph
  // reached is only eligible when the page is tied to the seed entity:
  // official website, links back to the seed, or the name matches what the
  // account itself says (display name / bio / headline). Anything else is
  // shown as a possibility, never promoted. This is the rule that stops a
  // LinkedIn sidebar company from becoming the lead.
  type Cand = { value: string; sources: SourceRef[]; strength: number; origin: "website" | "bio" | "social" | "directory" | "domain" | "engine"; eligible: boolean };
  const cands: Cand[] = [];
  const PAGE_TITLE_PREFIX = /^(contact|about|about us|home|services?|our services|areas? we serve|locations?|faq|reviews?|gallery|blog|careers?|pricing|book(?:ing)?|schedule|get a quote|free quote|welcome to)\b[\s:|-]*/i;
  const IMPERATIVE_TITLE = /^(manage|get|find|learn|join|watch|shop|view|see|discover|explore|download|sign|start|request|book|schedule|call|contact|read|browse|search|track|check|apply|enter|log|login|create)\b/i;
  const addCand = (value: string, src: SourceRef, strength: number, origin: Cand["origin"], eligible = true) => {
    let v = decodeHtmlText(value)!.replace(/\s+/g, " ").trim();
    if (!v || v.length < 2) return;
    if (IMPERATIVE_TITLE.test(v) && v.split(/\s+/).length <= 5) return; // "Manage Your Appointments" is a page, not a name
    if (seedDisplayName && isProfileSeed && normalizeBusinessName(v) === normalizeBusinessName(seedDisplayName)) return; // that's the person, not a business
    if (isGenericServicePhrase(v)) return; // "Appliance Removal Services", "San Diego Junk Removal"
    if (/^[A-Z][a-z]+(?: [A-Z][a-z]+)?(?:, [A-Z]{2})?$/.test(v) && graph.locations.some((l) => l.city && v.toLowerCase().startsWith(l.city.toLowerCase()))) return; // a bare city, not a name
    const stripped = v.replace(PAGE_TITLE_PREFIX, "").trim();
    if (stripped && stripped !== v) {
      if (/^(in|of|for|near|around|to|at)\b/i.test(stripped)) return; // "Areas We Serve in San Diego County" -> nothing nameable left
      v = stripped; strength = Math.min(strength, 1); // "Contact Junk Seekers" -> supports "Junk Seekers", weakly
    }
    const nv = normalizeBusinessName(v);
    if (!nv) return;
    const existing = cands.find((c) => normalizeBusinessName(c.value) === nv);
    if (existing) { existing.sources.push(src); existing.strength = Math.max(existing.strength, strength); existing.eligible = existing.eligible || eligible; return; }
    // A longer variant that CONTAINS an existing name ("San Diego's Trusted
    // Hauling & Junk Removal | Junk Seekers" vs "Junk Seekers") is the same
    // entity's tagline/page title -- supporting evidence, never a rival.
    const container = cands.find((c) => { const nc = normalizeBusinessName(c.value); return nc.length >= 4 && (nv.includes(nc) || nc.includes(nv)); });
    if (container) {
      // keep the shorter, cleaner form as the canonical name
      if (nv.length < normalizeBusinessName(container.value).length && strength >= container.strength) container.value = v;
      container.sources.push(src); container.strength = Math.max(container.strength, strength); container.eligible = container.eligible || eligible; return;
    }
    cands.push({ value: v, sources: [src], strength, origin, eligible });
  };
  // What the account itself says it is: display name (for business accounts)
  // and every business mentioned in its bio/headline.
  const selfNames: string[] = [];
  const bioMentionsEarly = seedBio && (isProfileSeed || sourceType.startsWith("INSTAGRAM") || sourceType.startsWith("X_") || sourceType.startsWith("TIKTOK") || sourceType === "LINKEDIN_PERSON_PROFILE") ? extractBusinessMentionsFromBio(seedBio) : [];
  for (const m of bioMentionsEarly) selfNames.push(normalizeBusinessName(m.name));
  if (seedDisplayName && !isProfileSeed) selfNames.push(normalizeBusinessName(seedDisplayName));
  if (seedMeta?.headline) selfNames.push(normalizeBusinessName(seedMeta.headline));
  const matchesSelf = (value: string) => { const nv = normalizeBusinessName(value); return nv.length >= 3 && selfNames.some((sn) => sn.length >= 3 && (sn.includes(nv) || nv.includes(sn))); };
  for (const c of graph.nameCandidates ?? []) {
    const d = (canonicalDomain(c.sourceUrl) || "").toLowerCase();
    const fromSeed = c.sourceUrl === seedUrl || platformOf(c.sourceUrl) === "facebook";
    if (fromSeed) continue; // seed names are handled via display name / bio
    // "Official" only counts when the website itself is trusted (verified by
    // the engine or linking back to the seed). An uncertain website guess --
    // e.g. a sidebar company a LinkedIn page happened to link to -- confers
    // no eligibility on the names found there.
    const onOfficial = !!officialDomain && d === officialDomain && website.status === "CONFIRMED";
    const linksBack = backlinkUrls.has(c.sourceUrl);
    const selfMatch = matchesSelf(c.value);
    // Keep the engine's own evidence grade (1 = <title>, 2 = og:title,
    // 3 = JSON-LD). Being on the official/backlinked site is corroboration,
    // not a promotion: lifting every sub-page <title> ("Contact Junk
    // Seekers", "Areas We Serve in San Diego County") to full strength
    // manufactured a fake identity conflict on the first live Instagram run.
    if (onOfficial || linksBack) addCand(c.value, ref(c.sourceUrl), c.strength, "website", true);
    else if (platformOf(c.sourceUrl) === "google_business" || platformOf(c.sourceUrl) === "yelp" || platformOf(c.sourceUrl) === "bbb") addCand(c.value, ref(c.sourceUrl), 2, "directory", selfMatch);
    else if (selfMatch) addCand(c.value, ref(c.sourceUrl), c.strength, "website", true);
    else if (c.strength >= 2) addCand(c.value, ref(c.sourceUrl), Math.min(c.strength, 2), "website", false); // reachable page, no tie to the seed -- a possibility only
  }
  const bioMentions = bioMentionsEarly;
  for (const m of bioMentions) addCand(m.name, seedRef(m.excerpt), 1, "bio");
  if (!isProfileSeed && graph.businessName?.value) addCand(graph.businessName.value, ref(graph.businessName.sourceUrl), graph.businessName.strength, "engine");
  if (cands.length === 0 && officialDomain && isProfileSeed) addCand(humanizeDomain(officialDomain), ref(website.value), 0, "domain");

  // ---- business signals (public evidence only) ----
  const signals: BusinessSignal[] = [];
  if (website.status === "CONFIRMED") signals.push({ signal: "website", detail: website.value!, sourceUrl: website.sources[0]?.url ?? null });
  for (const p of phones.filter((p) => p.status === "CONFIRMED" || p.status === "CONFLICT")) signals.push({ signal: "phone", detail: p.value!, sourceUrl: p.sources[0]?.url ?? null });
  for (const e of emails.filter((e) => e.status === "CONFIRMED")) signals.push({ signal: "email", detail: e.value!, sourceUrl: e.sources[0]?.url ?? null });
  for (const ch of channels) signals.push({ signal: ch.kind, detail: ch.value, sourceUrl: null });
  for (const sp of socialProfiles.filter((x) => x.association === "confirmed_first_party" || x.association === "likely_first_party")) if (sp.platform !== "facebook") signals.push({ signal: `social_${sp.platform}`, detail: sp.handle || sp.url || "", sourceUrl: sp.url ?? null });
  if (graph.services.length) signals.push({ signal: "services", detail: graph.services.slice(0, 5).join(", "), sourceUrl: null });
  if (graph.category) signals.push({ signal: "category", detail: graph.category, sourceUrl: null });
  if (seedBio) {
    const bioText = seedBio.replace(/join facebook to connect with.*$/i, "");
    const role = ROLE_TOKENS.find((r) => r.re.test(bioText));
    if (role) signals.push({ signal: "role_in_bio", detail: bioText.match(role.re)![0], sourceUrl: seedUrl });
    if (TRADE_TOKENS.test(bioText)) signals.push({ signal: "trade_terms_in_bio", detail: bioText.match(TRADE_TOKENS)![0], sourceUrl: seedUrl });
    if (CTA_TOKENS.test(bioText)) signals.push({ signal: "call_to_action_in_bio", detail: bioText.match(CTA_TOKENS)![0], sourceUrl: seedUrl });
  }
  for (const m of bioMentions) signals.push({ signal: "business_name_in_bio", detail: m.name, sourceUrl: seedUrl });

  // ---- SEED LOCK: a resolved business-type seed names the business. Other
  // candidates corroborate (fold in) or stay possibilities; none replaces it.
  const seedLock = graph.seedEntity?.resolved && graph.seedEntity.entityHint === "business" && graph.seedEntity.displayName ? graph.seedEntity : null;
  if (seedLock) {
    const sn = normalizeSeedName(seedLock.displayName!);
    const existing = cands.find((c) => { const nc = normalizeBusinessName(c.value); return nc === sn || nc.includes(sn) || sn.includes(nc); });
    if (existing) { existing.value = seedLock.displayName!; existing.strength = 3; existing.eligible = true; existing.sources.push(ref(seedLock.canonicalUrl, "seed display name")); }
    else cands.unshift({ value: seedLock.displayName!, sources: [ref(seedLock.canonicalUrl, "seed display name")], strength: 3, origin: "engine", eligible: true });
    for (const c of cands) if (c.value !== seedLock.displayName) { c.eligible = c.eligible && c.strength >= 3 && c.sources.some((sr) => backlinkUrls.has(sr.url)); } // only a backlinked JSON-LD name can even be a rival
  }
  // ---- pick the business name: strongest, with independent-source count ----
  // Once a structured-data-grade name exists, long weak phrases from the same
  // site are its taglines and page titles ("San Diego's Trusted Hauling &
  // Junk Removal", "Appliance Removal Services in San Diego"), and bare
  // <title> fragments are too noisy to be names at all. Candidates from OTHER
  // sources are kept -- a weak rival is still worth showing as "possible".
  const anchor = cands.find((c) => c.eligible && c.strength >= 3);
  if (anchor) {
    const anchorDomains = new Set(anchor.sources.map((sr) => (canonicalDomain(sr.url) || "").toLowerCase()));
    for (let i = cands.length - 1; i >= 0; i--) {
      const c = cands[i];
      if (c === anchor) continue;
      const sameSite = c.sources.every((sr) => anchorDomains.has((canonicalDomain(sr.url) || "").toLowerCase()));
      const longPhrase = c.value.split(/\s+/).length >= 4;
      if (c.strength <= 1 || (sameSite && c.strength <= 2 && longPhrase)) cands.splice(i, 1);
    }
  }
  // Ineligible candidates are shown as possibilities only if they look like a
  // name at all -- LinkedIn article titles and video titles are not.
  const SENTENCE_WORDS = /\b(what|why|how|here|this|that|your|you|we|our|about|can|will|should|always|ever|top|best|ways?|reasons?|tips?|questions?|learn|teach|content|games?|read|reads)\b/i;
  for (let i = cands.length - 1; i >= 0; i--) {
    const c = cands[i];
    if (c.eligible) continue;
    const words = c.value.split(/\s+/).length;
    if (words > 4 || c.value.length > 40 || SENTENCE_WORDS.test(c.value) || PLATFORM_BRAND_HANDLES.has(c.value.toLowerCase().replace(/[^a-z0-9]/g, "")) || /\b(linkedin|instagram|tiktok|youtube|facebook|twitter)\b/i.test(c.value)) cands.splice(i, 1);
  }
  cands.sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.strength - a.strength || b.sources.length - a.sources.length);
  const top = cands.find((c) => c.eligible) ?? null;
  const ineligibleOnly = !top && cands.length > 0;
  if (ineligibleOnly) notes.push(`Pages were reached that name ${cands.slice(0, 2).map((c) => `"${c.value}"`).join(" / ")}, but nothing ties them to this account (no link back, no match with what the account says). Shown as possibilities only.`);
  const independentSources = (c: Cand) => new Set(c.sources.map((s) => platformOf(s.url) === "website" ? (canonicalDomain(s.url) || s.url) : platformOf(s.url))).size;
  // Independent corroboration also counts a bio mention that matches a website/directory name.
  // Only a rival the sources themselves assert as THE business (JSON-LD /
  // resolved official name, strength 3) on a first-party page is a genuine
  // collision. og:titles and page titles never are -- they are taglines.
  const strongOthers = cands.filter((c) => c !== top && c.eligible && c.strength >= 3 && top!.strength >= 3 && c.sources.some((s) => firstPartyUrls.has(s.url)));
  if (top && strongOthers.length) {
    conflicts.push({ field: "business_name", values: [top, ...strongOthers].map((c) => ({ value: c.value, sources: c.sources })), note: "First-party sources name different businesses. Could be a rebrand, a parent/DBA pair, or the wrong website -- confirm which business this account represents before saving." });
  }

  // ---- person ----
  let person: PersonEntity | null = null;
  const bioRole = seedBio ? ROLE_TOKENS.find((r) => r.re.test(seedBio.replace(/join facebook.*$/i, "")))?.role ?? null : null;
  if (isProfileSeed && seedDisplayName) {
    const fbUser = (() => { try { const u = new URL(seedUrl); const id = u.searchParams.get("id"); return id ? `profile.php?id=${id}` : u.pathname.split("/").filter(Boolean)[0] ?? null; } catch { return null; } })();
    person = {
      name: seedDisplayName,
      facebookUrl: seedUrl,
      facebookUsername: (sourceType.startsWith("INSTAGRAM") || sourceType.startsWith("X_") || sourceType.startsWith("TIKTOK")) && fbUser ? `@${fbUser.replace(/^@/, "")}` : sourceType.startsWith("LINKEDIN") ? (() => { try { const u = new URL(seedUrl); return u.pathname.replace(/\/+$/, ""); } catch { return fbUser; } })() : fbUser,
      bio: seedBio ? seedBio.replace(/\s*join facebook to connect with.*$/i, "").trim() || null : null,
      publicLocation: graph.locations.find((l) => l.sourceUrl === seedUrl && (l.city || l.state)) ? [graph.locations.find((l) => l.sourceUrl === seedUrl)!.city, graph.locations.find((l) => l.sourceUrl === seedUrl)!.state].filter(Boolean).join(", ") : null,
      role: bioRole ?? (bioMentions.find((m) => m.role)?.role ?? null),
      confidence: "HIGH", // the display name of the fetched profile is a direct observation
      sources: [seedRef(seedDisplayName)],
    };
  } else if (graph.ownerName) {
    person = { name: graph.ownerName, facebookUrl: null, facebookUsername: null, bio: null, publicLocation: null, role: "OWNER", confidence: "MEDIUM", sources: website.sources };
  }

  // ---- classify ----
  let entityType: EntityType = "UNKNOWN";
  let businessStatus: BusinessStatus = "NO_BUSINESS_IDENTIFIED";
  let identityConfidence: IdentityConfidence = "not_found";
  let identityStatus: FieldStatus = "NOT_FOUND";
  let relationship: EntityRelationship | null = null;
  let business: BusinessEntity | null = null;

  const linksBackToSeed = top ? top.sources.some((sr) => backlinkUrls.has(sr.url)) : false;
  const corroboration = top ? independentSources(top) + (top.origin !== "bio" && bioMentions.some((m) => normalizeBusinessName(m.name) === normalizeBusinessName(top.value)) ? 1 : 0) + (linksBackToSeed ? 1 : 0) : 0;
  const hardSignals = signals.filter((s) => ["website", "phone", "email", "booking", "whatsapp"].includes(s.signal)).length;

  if (conflicts.length) {
    identityConfidence = "conflict"; identityStatus = "CONFLICT";
    businessStatus = "BUSINESS_IDENTITY_UNCERTAIN"; entityType = isProfileSeed ? "UNKNOWN" : "BUSINESS";
    business = { name: null, candidates: cands.slice(0, 5).map((c) => ({ value: c.value, sources: c.sources, strength: c.strength })), status: "CONFLICT", confidence: "LOW" };
    notes.push("Two or more first-party sources name different businesses -- genuine identity collision.");
  } else if (top && (top.strength >= 2 || corroboration >= 2 || (top.strength >= 1 && hardSignals >= 1))) {
    const confirmed = corroboration >= 2 || (top.strength >= 2 && hardSignals >= 1);
    identityConfidence = confirmed ? "confirmed" : "uncertain"; identityStatus = confirmed ? "CONFIRMED" : "UNCERTAIN";
    business = { name: top.value, candidates: cands.filter((c) => c === top || c.eligible).slice(0, 4).map((c) => ({ value: c.value, sources: c.sources, strength: c.strength })), status: identityStatus, confidence: confirmed ? (corroboration >= 3 ? "HIGH" : "HIGH") : "MEDIUM" };
    if (isProfileSeed && person) {
      const selfDescribed = bioMentions.some((m) => normalizeBusinessName(m.name) === normalizeBusinessName(top.value));
      // An employer field / representative title ties the person TO the
      // business without making them its operator. Ownership is never
      // inferred from "works at" / "Sales Manager at".
      const mentionRole = bioMentions.find((m) => normalizeBusinessName(m.name) === normalizeBusinessName(top.value))?.role ?? person.role;
      const operates = !mentionRole || OPERATING_ROLES.has(mentionRole) || (!!graph.ownerName && normalizeBusinessName(graph.ownerName) === normalizeBusinessName(person.name));
      entityType = operates ? "PERSON_OPERATING_BUSINESS" : "PERSON"; businessStatus = operates ? "PERSON_OPERATING_BUSINESS" : "PERSON_ASSOCIATED_WITH_BUSINESS";
      if (!operates) notes.push(`${person.name} is linked to ${top.value} as ${(mentionRole ?? "associated").toLowerCase()} -- not its operator. Ownership is never inferred from an employer or title field.`);
      // Corroborated = an independent source (website JSON-LD founder/employee, or the site naming the person) ties the person to the business.
      const siteNamesPerson = !!graph.ownerName && normalizeBusinessName(graph.ownerName) === normalizeBusinessName(person.name);
      const basisRel: RelationshipBasis = siteNamesPerson ? "corroborated" : selfDescribed ? "self_described" : "inferred";
      const relType: RelationshipType = mentionRole ?? person.role ?? (siteNamesPerson ? "OWNER" : "UNKNOWN");
      const explanation: string[] = [];
      if (selfDescribed) explanation.push(`Facebook bio describes ${person.name} as ${(person.role ?? "connected to").toString().toLowerCase().replace("_", " ")} of ${top.value}.`);
      if (website.status === "CONFIRMED") explanation.push(`Profile links to ${website.value} which names ${top.value}.`);
      if (linksBackToSeed) explanation.push(`${top.value}'s website links back to this exact ${seedHandle ? `@${seedHandle}` : "account"} -- cross-link verified.`);
      if (siteNamesPerson) explanation.push(`The business website names ${person.name}.`);
      for (const sp of socialProfiles.filter((x) => x.association !== "rejected_unrelated" && x.platform !== "facebook" && x.url)) if (top.sources.some((s) => s.url === sp.url)) explanation.push(`${sp.platform} account matches ${top.value}.`);
      if (!explanation.length) explanation.push(`${top.value} was found through links on the profile; the relationship itself is inferred, not stated.`);
      relationship = {
        relationshipType: relType,
        basis: basisRel,
        confidence: basisRel === "corroborated" ? "HIGH" : basisRel === "self_described" ? (confirmed ? "MEDIUM" : "LOW") : "LOW",
        evidence: Array.from(new Map([...top.sources, ...person.sources].map((s) => [s.url, s])).values()),
        explanation,
      };
      if (basisRel === "self_described") notes.push(`Relationship is self-described on the Facebook profile only -- shown as "self-described ${relType.toLowerCase()}", not confirmed owner.`);
      if (!confirmed) notes.push("Business identified from a single source; add the website or Google Business listing to confirm.");
    } else {
      entityType = sourceType === "LINKEDIN_ORGANIZATION_PAGE" ? "ORGANIZATION" : "BUSINESS"; businessStatus = "BUSINESS";
      if (person) relationship = { relationshipType: person.role ?? "OWNER", basis: "corroborated", confidence: "MEDIUM", evidence: person.sources, explanation: [`Structured data on the website names ${person.name}.`] };
      if (linksBackToSeed) notes.push(`${top.value}'s website links back to this exact account -- cross-link verified.`);
      if (!confirmed) notes.push("Business name found but only weakly corroborated by a second signal (domain/phone).");
    }
  } else if ((isProfileSeed && (signals.length >= 2 || top)) || ineligibleOnly) {
    entityType = "UNKNOWN"; businessStatus = "BUSINESS_IDENTITY_UNCERTAIN";
    identityConfidence = "uncertain"; identityStatus = "UNCERTAIN";
    business = { name: null, candidates: cands.slice(0, 3).map((c) => ({ value: c.value, sources: c.sources, strength: c.strength })), status: "UNCERTAIN", confidence: "LOW" };
    notes.push(`Business signals detected (${signals.map((s) => s.signal.replace(/_/g, " ")).slice(0, 5).join(", ")}) but the exact business could not be identified${top ? ` -- possibly "${top.value}"` : ""}. Add the business website or listing and Research More.`);
  } else if (isProfileSeed) {
    entityType = "PERSON"; businessStatus = "NO_BUSINESS_IDENTIFIED";
    identityConfidence = "not_found"; identityStatus = "NOT_FOUND";
    notes.push(`${person?.name ?? "This account"} appears to be an individual with no public business connection found. The profile research is retained; no company has been invented.`);
  } else if (sourceType === "FACEBOOK_GROUP" || sourceType === "FACEBOOK_EVENT") {
    entityType = "ORGANIZATION"; businessStatus = "BUSINESS_IDENTITY_UNCERTAIN"; identityConfidence = "uncertain"; identityStatus = "UNCERTAIN";
    notes.push(`Seed is a Facebook ${sourceType === "FACEBOOK_GROUP" ? "group" : "event"}, not a business account.`);
  } else if (graph.businessName?.value) {
    entityType = "BUSINESS"; businessStatus = "BUSINESS"; identityConfidence = "uncertain"; identityStatus = "UNCERTAIN";
    business = { name: graph.businessName.value, candidates: [{ value: graph.businessName.value, sources: [ref(graph.businessName.sourceUrl)], strength: graph.businessName.strength }], status: "UNCERTAIN", confidence: "LOW" };
    notes.push("Business name comes from a single weak source.");
  } else {
    notes.push("No business name could be established from public sources.");
  }

  if (sourceType === "FACEBOOK_UNKNOWN") notes.push("Facebook vanity URL: could not tell Page from profile by URL or page text; classification is inferred from the account's display name.");

  return {
    entities: { sourceType, sourceTypeBasis: basis, entityType, businessStatus, person, business, relationship, businessSignals: signals, notes },
    identityConfidence,
    identityStatus,
    notes,
    conflicts,
  };
}

// ---------- link classification -> SourceEntity (Spec §4) ----------

const BUSINESS_PROFILE_HOSTS = ["yelp.com", "bbb.org", "tripadvisor.com", "angi.com", "thumbtack.com", "homeadvisor.com", "houzz.com", "porch.com", "nextdoor.com", "yellowpages.com", "mapquest.com"];
const IGNORE_PATTERNS = [/fbclid=/, /utm_/, /\/login/, /\/signup/, /\/ads?\//, /doubleclick/, /googletagmanager/, /amazon\.com/, /\/sharer/, /\/share\?/, /\/help\//, /\/privacy/, /\/terms/, /\.(ico|png|jpe?g|gif|svg|webp|webmanifest|xml|json|css|js)(\?|$)/, /\/manifest/, /\/opensearch/, /\/data\//];

export { isSocialProfilePath } from "./normalize";
const PLATFORM_BRAND_HANDLES = new Set(["tiktokcreators", "tiktokforbusiness", "linkedinnews", "linkedinhelp", "xdevelopers", "youtube", "youtubecreators", "teamyoutube", "instagram", "facebook", "facebookapp", "meta", "tiktok", "tiktok_us", "twitter", "x", "linkedin", "google", "googlemaps", "whatsapp", "pinterest", "snapchat", "threads", "yelp", "nextdoor", "linktree", "linktr_ee"]);
const FB_RESERVED = new Set(["login", "home.php", "data", "help", "policies", "privacy", "terms", "ads", "business", "marketplace", "watch", "gaming", "groups", "events", "reel", "reels", "stories", "share", "sharer.php", "dialog", "plugins", "about", "careers", "developers", "settings", "messages", "notifications", "friends", "photo", "photo.php", "video.php", "hashtag", "search", "legal", "security", "l.php", "recover", "checkpoint", "r.php", "mobile", "lite"]);
const GENERIC_RESERVED = new Set(["explore", "about", "legal", "privacy", "terms", "help", "accounts", "p", "reel", "reels", "stories", "tv", "direct", "login", "signup", "i", "home", "search", "hashtag", "settings", "foryou", "following", "live", "discover", "upload", "download", "business", "creators", "new", "t", "s", "feed", "trends"]);

export function classifyLinkType(url: string, isOfficialDomain: boolean): { linkType: string; priority: 0 | 1 | 2 | 3 } {
  const lower = url.toLowerCase();
  if (IGNORE_PATTERNS.some((p) => p.test(lower))) return { linkType: "tracking_or_noise", priority: 0 };
  const cls = classifyLink(url);
  if (cls.kind === "infra") return { linkType: "platform_nav", priority: 0 };
  if (cls.kind === "whatsapp") return { linkType: "whatsapp", priority: 1 };
  if (cls.kind === "booking") return { linkType: "booking", priority: 1 };
  if (cls.kind === "linktree") return { linkType: "bio_link_hub", priority: 1 };
  if (cls.kind === "social") {
    const platform: string = (cls as any).platform ?? "social";
    return isSocialProfilePath(url, platform) ? { linkType: platform, priority: 1 } : { linkType: "platform_nav", priority: 0 };
  }
  const d = (canonicalDomain(url) || "").toLowerCase();
  if (d.includes("google.") && /maps|g\.page|business/.test(lower)) return { linkType: "google_business", priority: 2 };
  if (BUSINESS_PROFILE_HOSTS.some((h) => d === h || d.endsWith(`.${h}`))) return { linkType: "directory", priority: 2 };
  if (isOfficialDomain) return { linkType: "official_website", priority: 1 };
  return { linkType: "other", priority: 3 };
}

export function buildSourceEntities(graph: BusinessGraph, officialDomain: string | null): SourceEntity[] {
  const ordinalByUrl = new Map<string, number>();
  const out: SourceEntity[] = [];
  const log: SourceLogEntry[] = graph.sourceLog ?? [];
  log.forEach((entry, i) => ordinalByUrl.set(entry.url, i + 1));

  log.forEach((entry, i) => {
    const d = (canonicalDomain(entry.url) || "").toLowerCase();
    const isOfficialDomain = !!officialDomain && d === officialDomain;
    let { linkType, priority } = classifyLinkType(entry.url, isOfficialDomain);
    if (entry.indexedOnly) { linkType = "instagram_post"; priority = 1; }
    // Priority 0 = noise (tracking params, share links, platform nav). Even
    // if the crawler touched it, it is not a source of truth and must not
    // count toward sources_fetched.
    const fetchStatus: SourceEntity["fetchStatus"] =
      priority === 0 ? "skipped_priority"
      : entry.indexedOnly ? "indexed_public"
      : entry.genericPlatformContent ? "generic_platform_shell"
      : entry.fetchStatus === "ok" ? "fetched"
      : /login|wall|blocked/i.test(entry.blockedReason || "") ? "blocked_login_wall"
      : "unreachable";
    // First-party = seed itself, same domain as official site, or
    // discovered directly from a first-party page via its own links.
    const fromOrdinal = entry.discoveredFrom ? ordinalByUrl.get(entry.discoveredFrom) ?? null : null;
    const parentIsFirstParty = fromOrdinal ? out.find((s) => s.ordinal === fromOrdinal)?.isFirstParty ?? false : false;
    const meta = (graph.pageMeta ?? []).find((m) => m.url === entry.url || m.requestedUrl === entry.url);
    const linksToSeed = !!meta?.linksToSeed;
    const isFirstParty = entry.discoveryMethod === "seed" || isOfficialDomain || !!meta?.sameAccountAsSeed || linksToSeed || (priority === 1 && (parentIsFirstParty || entry.discoveryMethod === "bio_link" || entry.discoveryMethod === "social_link" || entry.discoveryMethod === "website_crawl"));
    // A platform shell we couldn't actually read yields no evidence, so it
    // can't be "likely first-party" on its own (unless it IS the seed).
    const association: Association =
      priority === 0 ? "not_applicable"
      : isFirstParty && (entry.discoveryMethod === "seed" || isOfficialDomain || linksToSeed || meta?.sameAccountAsSeed) ? "confirmed_first_party"
      : fetchStatus === "generic_platform_shell" || fetchStatus === "blocked_login_wall" ? "uncertain"
      : isFirstParty ? "likely_first_party"
      : priority === 3 ? "rejected_unrelated"
      : "uncertain";
    const em = meta?.entityMatch ?? null;
    const entityMatch: EntityMatchStatus = em?.status ?? (entry.discoveryMethod === "seed" ? "MATCHED" : priority === 0 ? "REJECTED" : association === "confirmed_first_party" ? "MATCHED" : association === "likely_first_party" ? "PROBABLE_MATCH" : association === "rejected_unrelated" ? "REJECTED" : entry.indexedOnly ? "MATCHED" : "UNVERIFIED");
    const entityMatchReasons = em?.reasons ?? (entry.discoveryMethod === "seed" ? ["This is the seed URL."] : entry.indexedOnly ? ["Indexed post of the exact seed account."] : priority === 0 ? ["Platform infrastructure or navigation."] : []);
    const sourceQuality: SourceEntity["sourceQuality"] = entry.discoveryMethod === "seed" ? "PRIMARY" : entityMatch === "MATCHED" ? "VERIFIED" : entityMatch === "PROBABLE_MATCH" ? "CORROBORATING" : entityMatch === "POSSIBLE_MATCH" || entityMatch === "UNVERIFIED" ? "WEAK" : "IRRELEVANT";
    out.push({
      ordinal: i + 1,
      url: entry.url,
      canonicalUrl: entry.url,
      platform: platformOf(entry.url),
      linkType,
      priority,
      isFirstParty: isFirstParty && entityMatch !== "REJECTED" && entityMatch !== "UNVERIFIED",
      association: entityMatch === "REJECTED" ? "rejected_unrelated" : entityMatch === "UNVERIFIED" ? "uncertain" : association,
      entityMatch,
      entityMatchReasons,
      sourceEntityName: meta?.ogTitle ?? null,
      sourceQuality,
      discoveredFromOrdinal: fromOrdinal,
      discoveryMethod: entry.discoveryMethod,
      depth: null,
      fetchStatus,
      skipReason: priority === 0 ? `ignored: ${linkType}` : entry.blockedReason ?? null,
      profileType: null,
      linksToSeed,
    });
  });
  return out;
}

// ---------- field reconciliation (Spec §3, §6) ----------

function toConfidence(status: FieldStatus, sourceCount: number, firstPartyCount: number): Confidence {
  if (status !== "CONFIRMED") return "LOW";
  if (firstPartyCount >= 2 || (firstPartyCount >= 1 && sourceCount >= 2)) return "HIGH";
  if (firstPartyCount >= 1) return "MEDIUM";
  return "LOW";
}

function reconcilePhones(contacts: ContactMethodRecord[], firstPartyUrls: Set<string>): { phones: PhoneValue[]; conflicts: Conflict[] } {
  const groups = new Map<string, { raw: string; refs: SourceRef[]; firstParty: number }>();
  for (const c of contacts.filter((c) => c.type === "phone" && c.value)) {
    const norm = normalizePhoneE164(c.value) ?? c.value!;
    const g = groups.get(norm) ?? { raw: c.value!, refs: [], firstParty: 0 };
    g.refs.push(ref(c.sourceUrl));
    if (c.sourceUrl && firstPartyUrls.has(c.sourceUrl)) g.firstParty += 1;
    groups.set(norm, g);
  }
  const phones: PhoneValue[] = Array.from(groups.entries()).map(([norm, g]) => {
    const status: FieldStatus = g.firstParty >= 1 ? "CONFIRMED" : g.refs.length >= 1 ? "UNCERTAIN" : "NOT_FOUND";
    return { value: g.raw, normalized: norm.startsWith("+") ? norm : null, kind: "unknown", status, confidence: toConfidence(status, g.refs.length, g.firstParty), sources: g.refs };
  });
  // Two or more DIFFERENT first-party-backed numbers is a real conflict to
  // surface, never silently resolved. (One main + one booking line is a
  // legitimate reason -- which is exactly why a human decides.)
  const conflicts: Conflict[] = [];
  const firstPartyPhones = phones.filter((p) => p.status === "CONFIRMED");
  if (firstPartyPhones.length > 1) {
    conflicts.push({ field: "phone", values: firstPartyPhones.map((p) => ({ value: p.value!, sources: p.sources })), note: "Multiple first-party phone numbers found. May be main vs. booking/location lines, or a mismatch between sources -- review before calling." });
    for (const p of firstPartyPhones) p.status = "CONFLICT";
  }
  return { phones, conflicts };
}

function reconcileEmails(contacts: ContactMethodRecord[], firstPartyUrls: Set<string>): FieldValue<string>[] {
  const groups = new Map<string, { refs: SourceRef[]; firstParty: number }>();
  for (const c of contacts.filter((c) => c.type === "email" && c.value)) {
    const key = c.value!.trim().toLowerCase();
    const g = groups.get(key) ?? { refs: [], firstParty: 0 };
    g.refs.push(ref(c.sourceUrl));
    if (c.sourceUrl && firstPartyUrls.has(c.sourceUrl)) g.firstParty += 1;
    groups.set(key, g);
  }
  return Array.from(groups.entries()).map(([email, g]) => {
    const status: FieldStatus = g.firstParty >= 1 ? "CONFIRMED" : "UNCERTAIN";
    return { value: email, status, confidence: toConfidence(status, g.refs.length, g.firstParty), sources: g.refs };
  });
}

function reconcileIdentity(graph: BusinessGraph, seedUrl: string, analysis: ReturnType<typeof analyzeEntities>): ResearchProfile["identity"] {
  const { entities, identityConfidence, identityStatus } = analysis;
  const bizName = entities.business?.name ?? null;
  const bizSources = entities.business?.candidates.find((c) => c.value === bizName)?.sources ?? [];
  const displayNames: { value: string; sources: SourceRef[] }[] = [];
  if (entities.person) displayNames.push({ value: entities.person.name, sources: entities.person.sources });
  if (bizName) displayNames.push({ value: bizName, sources: bizSources });
  return {
    businessName: { value: bizName, status: identityStatus, confidence: entities.business?.confidence ?? "LOW", sources: bizSources },
    displayNames,
    profileType: detectFacebookProfileType(seedUrl, graph.businessName?.value ?? null),
    category: { value: graph.category, status: graph.category ? "INFERRED" : "NOT_FOUND", confidence: "LOW", sources: [] },
    description: { value: graph.description, status: graph.description ? "CONFIRMED" : "NOT_FOUND", confidence: graph.description ? "MEDIUM" : "LOW", sources: [] },
    identityConfidence,
    identityNotes: analysis.notes,
  };
}

// ---------- sales intelligence (Spec §10) -- template-driven, facts only ----------

function buildSalesIntelligence(p: Omit<ResearchProfile, "salesIntelligence">): SalesIntelligence {
  const ent = p.entities;
  const name = ent.business?.name ?? p.identity.businessName.value ?? (ent.entityType === "PERSON" && ent.person ? ent.person.name : "This business");
  const cat = p.identity.category.value;
  const city = p.locations.physical[0]?.city ?? p.locations.serviceArea[0]?.city ?? null;
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const howTheySell: string[] = [];
  const contactMethods: string[] = [];

  if (p.website.status === "CONFIRMED") { strengths.push("Has a confirmed official website"); howTheySell.push("Website"); }
  else weaknesses.push("No confirmed official website found");
  const confirmedPhones = p.contacts.phones.filter((x) => x.status === "CONFIRMED" || x.status === "CONFLICT");
  if (confirmedPhones.length) contactMethods.push(`Phone (${confirmedPhones.length} number${confirmedPhones.length > 1 ? "s" : ""})`); else weaknesses.push("No first-party phone number found");
  if (p.contacts.emails.some((e) => e.status === "CONFIRMED")) contactMethods.push("Email"); else weaknesses.push("No public email found");
  for (const s of p.socialProfiles) {
    if (s.association === "confirmed_first_party" || s.association === "likely_first_party") { howTheySell.push(s.platform.charAt(0).toUpperCase() + s.platform.slice(1)); }
  }
  if (p.contacts.channels.some((c) => c.kind === "booking")) { howTheySell.push("Online booking"); strengths.push("Online booking available"); } else weaknesses.push("No online booking system found");
  if (p.contacts.channels.some((c) => c.kind === "whatsapp")) contactMethods.push("WhatsApp");
  if (p.business.pricing.note === "NO_PUBLIC_PRICING_FOUND") weaknesses.push("No public pricing found");
  if (p.locations.physical.length === 0 && p.locations.serviceArea.length > 0) weaknesses.push("Service-area business with no published physical address");
  if (p.locations.physical.length === 0 && p.locations.serviceArea.length === 0) weaknesses.push("No location information found");
  for (const c of p.conflicts) weaknesses.push(`${c.field.charAt(0).toUpperCase() + c.field.slice(1)} differs between sources`);
  const inaccessible = p.sources.filter((s) => s.fetchStatus === "blocked_login_wall" || s.fetchStatus === "generic_platform_shell").length;
  if (inaccessible) weaknesses.push(`${inaccessible} source${inaccessible > 1 ? "s" : ""} could not be read (login wall)`);

  const best = confirmedPhones[0] ? `Phone ${confirmedPhones[0].value}` : p.contacts.channels.find((c) => c.kind === "whatsapp") ? "WhatsApp" : p.contacts.emails[0]?.value ? `Email ${p.contacts.emails[0].value}` : null;
  const callPrep: string[] = [];
  if (ent.entityType === "PERSON") callPrep.push(`No business was identified for ${ent.person?.name ?? "this profile"} -- this is a person record, not a business lead.`);
  else if (ent.entityType === "PERSON_OPERATING_BUSINESS" && ent.relationship) {
    if (ent.relationship.basis === "self_described") callPrep.push(`${ent.person?.name} is a self-described ${ent.relationship.relationshipType.toLowerCase()} of ${ent.business?.name} (Facebook bio only) -- confirm the role early in the call.`);
    else if (ent.relationship.basis === "inferred") callPrep.push(`${ent.business?.name} was found via links on ${ent.person?.name}'s profile; the connection is inferred -- confirm they run it.`);
    else callPrep.push(`Ask for ${ent.person?.name} -- ${ent.relationship.relationshipType.toLowerCase()} of ${ent.business?.name} (corroborated).`);
  } else if (p.identity.identityConfidence !== "confirmed") callPrep.push("Identity is not fully confirmed -- verify you have the right business in the first 10 seconds of the call.");
  for (const w of weaknesses.slice(0, 3)) callPrep.push(`Observed gap: ${w.toLowerCase()}.`);
  if (p.conflicts.length) callPrep.push("Ask which phone number is the main line -- sources disagree.");

  // schema.org types arrive as "LocalBusiness"/"HomeAndConstructionBusiness";
  // humanize and avoid "a localbusiness business".
  const humanCat = cat ? cat.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().replace(/\s*business$/, "").trim() : null;
  const lead =
    ent.entityType === "PERSON" ? `${name} appears to be an individual; no business was identified from public sources.`
    : ent.entityType === "PERSON_OPERATING_BUSINESS" && ent.person && ent.business?.name ? `${ent.person.name} ${ent.relationship?.basis === "corroborated" ? "is the" : "appears to be the"} ${(ent.relationship?.relationshipType ?? "operator").toLowerCase()} of ${ent.business.name}${humanCat ? `, a ${humanCat} business` : ""}${city ? ` in ${city}` : ""}.`
    : ent.businessStatus === "BUSINESS_IDENTITY_UNCERTAIN" ? `${ent.person?.name ?? "This account"} shows business signals but the exact business is uncertain${ent.business?.candidates[0] ? ` (possibly ${ent.business.candidates[0].value})` : ""}.`
    : `${name}${humanCat ? ` appears to operate as a ${humanCat} business` : ""}${city ? ` in ${city}` : ""}.`;
  const summary = `${lead} ${p.website.status === "CONFIRMED" ? "Official website confirmed. " : ""}${howTheySell.length ? `Visible channels: ${Array.from(new Set(howTheySell)).join(", ")}.` : "No confirmed online channels beyond the seed source."}`.trim();

  return { summary, whatTheyDo: p.business.services.slice(0, 8), howTheySell: Array.from(new Set(howTheySell)), contactMethods, onlineStrengths: strengths, onlineWeaknesses: weaknesses, bestContactChannel: best, callPrep };
}

// ---------- main ----------

const CHECKLIST_WEIGHTS: { key: string; weight: number }[] = [
  { key: "identity", weight: 3 }, { key: "phone", weight: 3 }, { key: "website", weight: 2 }, { key: "email", weight: 1 },
  { key: "physical_location", weight: 2 }, { key: "service_area", weight: 1 }, { key: "category", weight: 1 }, { key: "services", weight: 2 },
  { key: "socials", weight: 1 },
];

export function reconcileGraph(graph: BusinessGraph, seedUrl: string): ResearchProfile {
  const websiteCandidate = graph.contactMethods.find((c) => c.type === "website" && c.value);
  const officialDomain = websiteCandidate?.value ? (canonicalDomain(websiteCandidate.value) || "").toLowerCase() || null : null;
  // The official domain is only TRUSTED when the engine verified the website
  // or a page on it links back to the seed. An uncertain guess (observed
  // live: a sidebar company's site) must not make its pages first-party.
  const websiteLinksBackEarly = !!officialDomain && (graph.pageMeta ?? []).some((m) => m.linksToSeed && (canonicalDomain(m.url) || "").toLowerCase() === officialDomain);
  const trustedOfficialDomain = officialDomain && (websiteCandidate?.status === "verified" || websiteLinksBackEarly) ? officialDomain : null;
  const sources = buildSourceEntities(graph, trustedOfficialDomain);
  const firstPartyUrls = new Set(sources.filter((s) => s.isFirstParty).map((s) => s.url));
  // The seed and the TRUSTED official site are first-party by definition even
  // if the source log recorded them under a different URL form.
  firstPartyUrls.add(seedUrl);
  if (websiteCandidate?.value && trustedOfficialDomain) firstPartyUrls.add(websiteCandidate.value);
  // Observed live: facebook.com/profile.php?id=N redirects to
  // facebook.com/people/<Name>/N/ and the engine attributes phone/name to
  // the redirect target. Every fetched URL the engine flagged as the seed
  // page is first-party, whatever form the URL took.
  for (const m of graph.pageMeta ?? []) if (m.isSeed || m.sameAccountAsSeed || m.linksToSeed) { firstPartyUrls.add(m.url); firstPartyUrls.add(m.requestedUrl); }
  for (const s of sources) if (firstPartyUrls.has(s.url) && !s.isFirstParty) { s.isFirstParty = true; if (s.association === "uncertain") s.association = "confirmed_first_party"; }

  const websiteLinksBack = websiteLinksBackEarly;
  const website: FieldValue<string> = websiteCandidate?.value
    ? { value: websiteCandidate.value, status: websiteCandidate.status === "verified" || websiteLinksBack ? "CONFIRMED" : websiteCandidate.status === "conflict" ? "CONFLICT" : "UNCERTAIN", confidence: websiteCandidate.status === "verified" || websiteLinksBack ? "HIGH" : "LOW", sources: [ref(websiteCandidate.sourceUrl), ...(websiteLinksBack ? [ref(websiteCandidate.value, "links back to the seed account")] : [])] }
    : { value: null, status: graph.websiteDiscovery?.status === "discovery_unavailable" ? "INACCESSIBLE" : "NOT_FOUND", confidence: "LOW", sources: [] };

  if (website.value && website.status === "CONFIRMED") {
    try {
      const u = new URL(website.value);
      const segs = u.pathname.split("/").filter(Boolean);
      if (segs.length >= 2) website.value = `${u.origin}/${segs[0]}`; // "/us_en/blog/decluttering/..." -> "/us_en"
    } catch { /* keep as-is */ }
  }
  const { phones, conflicts } = reconcilePhones(graph.contactMethods, firstPartyUrls);
  const emails = reconcileEmails(graph.contactMethods, firstPartyUrls);
  const channels = graph.contactMethods
    .filter((c) => c.value && ["whatsapp", "booking", "contact_form"].includes(c.type))
    .map((c) => ({ kind: c.type, value: c.value!, sources: [ref(c.sourceUrl)] }));

  // Defense in depth with the engine's gating: a location only counts when
  // its source page is tied to the seed entity.
  const hasTrustFlags = (graph.pageMeta ?? []).some((m) => m.trusted !== undefined);
  const trustedUrls = new Set([...firstPartyUrls, ...(graph.pageMeta ?? []).filter((m) => m.trusted).flatMap((m) => [m.url, m.requestedUrl])]);
  const locationOk = (l: LocationRecord) => !hasTrustFlags || !l.sourceUrl || trustedUrls.has(l.sourceUrl) || (!!officialDomain && (canonicalDomain(l.sourceUrl) || "").toLowerCase() === officialDomain && website.status === "CONFIRMED");
  const physical = graph.locations.filter((l) => (l.locationType === "primary" || l.locationType === "branch") && locationOk(l));
  const serviceArea = graph.locations.filter((l) => l.locationType === "service_area" && locationOk(l));

  const socialProfiles = graph.socialProfiles.map((s) => {
    // Observed live: a YouTube channel page's own chrome links to
    // x.com/YouTube, and the crawler attributed it to the business. A handle
    // that IS a platform brand is never the business's account.
    const handle = (s.handle || s.url?.split("/").filter(Boolean).pop() || "").replace(/^@/, "").toLowerCase();
    if (PLATFORM_BRAND_HANDLES.has(handle)) return { ...s, status: "not_found" as const, association: "rejected_unrelated" as Association };
    const srcEntity = sources.find((e) => s.url && e.url === s.url);
    const association: Association = srcEntity?.association ?? (s.status === "verified" ? "likely_first_party" : "uncertain");
    return { ...s, association };
  });

  const analysis = analyzeEntities(graph, seedUrl, website, phones, emails, channels, socialProfiles, firstPartyUrls);
  conflicts.push(...analysis.conflicts);
  const identity = reconcileIdentity(graph, seedUrl, analysis);
  const entities = analysis.entities;

  const limitations: Limitation[] = [];
  if (entities.businessStatus === "BUSINESS_IDENTITY_UNCERTAIN") limitations.push({ code: "BUSINESS_IDENTITY_UNCERTAIN", message: "Business signals exist but the exact business could not be confirmed." });
  else if (entities.businessStatus !== "NO_BUSINESS_IDENTIFIED" && identity.identityConfidence !== "confirmed") limitations.push({ code: "IDENTITY_NOT_CONFIRMED", message: "Business identity could not be confirmed with two independent signals." });
  if (entities.relationship?.basis === "self_described") limitations.push({ code: "RELATIONSHIP_SELF_DESCRIBED", message: "The person-to-business relationship is stated only on the Facebook profile; no independent source confirms it." });
  if (website.status === "INACCESSIBLE") limitations.push({ code: "DISCOVERY_UNAVAILABLE", message: "Wider-web website discovery did not run (no search provider configured)." });
  const recovery = graph.socialRecovery ?? graph.instagramRecovery ?? null;
  if (recovery && recovery.status !== "not_applicable") {
    const r = recovery;
    const platformLabel = ({ instagram: "Instagram", linkedin: "LinkedIn", x: "X", tiktok: "TikTok", facebook: "Facebook" } as Record<string, string>)[r.platform ?? "instagram"] ?? "The platform";
    const at = r.platform === "linkedin" ? `${r.handle}` : `@${r.handle}`;
    limitations.push({
      code: `${(r.platform ?? "instagram").toUpperCase()}_PROFILE_LOGIN_WALLED`,
      message: r.status === "found"
        ? `${platformLabel} serves this profile page only to logged-in browsers; identity was recovered from ${r.postsFound} public post${r.postsFound === 1 ? "" : "s"}/page${r.postsFound === 1 ? "" : "s"} of the account and ${r.backlinkCandidates} page${r.backlinkCandidates === 1 ? "" : "s"} linking to ${at} in the public search index (${r.provider}). Bio, follower count and account type are not readable directly.`
        : r.status === "not_found" ? `${platformLabel} profile is login-walled and no public posts or pages linking to ${at} were found in the search index.`
        : `${platformLabel} profile is login-walled and public-index recovery could not run: ${r.reason}`,
    });
  }
  const blocked = sources.filter((s) => s.fetchStatus === "blocked_login_wall" || s.fetchStatus === "generic_platform_shell");
  if (blocked.length) limitations.push({ code: "SOURCES_INACCESSIBLE", message: `${blocked.length} source(s) were login-walled or returned platform boilerplate and could not be read.` });

  const checks: Record<string, boolean> = {
    // A confirmed PERSON with no business is a correctly identified entity, not a miss.
    identity: identity.identityConfidence === "confirmed" || (entities.entityType === "PERSON" && !!entities.person),
    phone: phones.some((p) => p.status === "CONFIRMED" || p.status === "CONFLICT"),
    website: website.status === "CONFIRMED",
    email: emails.some((e) => e.status === "CONFIRMED"),
    physical_location: physical.some((l) => l.status === "verified"),
    service_area: serviceArea.length > 0,
    category: !!graph.category,
    services: graph.services.length > 0,
    socials: socialProfiles.some((s) => s.association === "confirmed_first_party" || s.association === "likely_first_party"),
  };
  const totalWeight = CHECKLIST_WEIGHTS.reduce((a, b) => a + b.weight, 0);
  const earned = CHECKLIST_WEIGHTS.reduce((a, b) => a + (checks[b.key] ? b.weight : 0), 0);
  const fieldsVerified = Object.values(checks).filter(Boolean).length;

  // ---- PRE-SAVE FAIL-SAFE: no field may rest on a source that failed entity
  // matching. The engine already gates extraction; this is the last line.
  const statusByUrl = new Map(sources.map((src) => [src.url, src.entityMatch] as const));
  const bad = (u: string | null | undefined) => { if (!u) return false; if (graph.seedEntity && urlNamesSeed(u, graph.seedEntity)) return false; const st = statusByUrl.get(u); return st === "REJECTED" || st === "UNVERIFIED"; };
  const removed: string[] = [];
  const keepPhones = phones.filter((p) => { const allBad = p.sources.length > 0 && p.sources.every((sr) => bad(sr.url)); if (allBad) removed.push(`phone ${p.value}`); return !allBad; });
  const keepEmails = emails.filter((e) => { const allBad = e.sources.length > 0 && e.sources.every((sr) => bad(sr.url)); if (allBad) removed.push(`email ${e.value}`); return !allBad; });
  const keepPhysical = physical.filter((l) => { const b = bad(l.sourceUrl); if (b) removed.push(`location ${[l.city, l.state].filter(Boolean).join(", ")}`); return !b; });
  const keepService = serviceArea.filter((l) => !bad(l.sourceUrl));
  const handleOf = (u: string | null | undefined) => { if (!u) return ""; try { const x = new URL(/^https?:\/\//i.test(u) ? u : `https://${u}`); return `${platformOf(u)}:${x.pathname.split("/").filter(Boolean).join("/").toLowerCase().replace(/^@/, "")}`; } catch { return ""; } };
  const seedForMatch = graph.seedEntity ?? null;
  const namesSeed = (u: string | null | undefined) => !!u && !!seedForMatch && urlNamesSeed(u, seedForMatch);
  const rejectedHandles = new Set(sources.filter((src) => (src.entityMatch === "REJECTED" || src.entityMatch === "UNVERIFIED") && !namesSeed(src.url)).map((src) => handleOf(src.url)).filter(Boolean));
  const keepSocials = socialProfiles.map((sp) => {
    if (namesSeed(sp.url)) return { ...sp, status: "verified" as const, association: "confirmed_first_party" as Association }; // the seed account itself
    const notProfile = !!sp.url && sp.platform !== "whatsapp" && !isSocialProfilePath(sp.url, sp.platform);
    const fromBad = (sp.url && bad(sp.url)) || (sp.sourceUrl && bad(sp.sourceUrl)) || rejectedHandles.has(handleOf(sp.url));
    if (notProfile || fromBad) { removed.push(`${sp.platform} ${sp.url ?? sp.handle ?? ""}`); return { ...sp, status: "not_found" as const, association: "rejected_unrelated" as Association }; }
    return sp;
  });
  if (website.value && (bad(websiteCandidate?.sourceUrl ?? null) || bad(website.value)) && website.status !== "CONFIRMED") { removed.push(`website ${website.value}`); website.value = null; website.status = "NOT_FOUND"; website.sources = []; }
  if (removed.length) limitations.push({ code: "FIELDS_REMOVED_UNMATCHED_SOURCE", message: `Removed ${removed.length} field value(s) whose only sources failed entity matching: ${removed.slice(0, 5).join("; ")}.` });

  const base: Omit<ResearchProfile, "salesIntelligence"> = {
    identity,
    contacts: { phones: keepPhones, emails: keepEmails, channels },
    locations: { physical: keepPhysical, serviceArea: keepService },
    website,
    socialProfiles: keepSocials,
    business: { services: graph.services, pricing: { note: "NO_PUBLIC_PRICING_FOUND" } },
    sources,
    conflicts,
    limitations,
    entities,
    seed: graph.seedEntity ?? null,
    metrics: {
      researchConfidencePct: Math.round((100 * earned) / totalWeight),
      fieldsVerified,
      fieldsTotal: Object.keys(checks).length,
      sourcesChecked: sources.length,
      sourcesFetched: sources.filter((s) => s.fetchStatus === "fetched" || s.fetchStatus === "indexed_public").length,
      researchStatus: limitations.length ? "completed_with_limitations" : "complete",
    },
  };
  return { ...base, salesIntelligence: buildSalesIntelligence(base) };
}

/** Save rule: never block because the seed is a personal profile, isn't a
 * Page, or the business name differs from the person's name. Block ONLY on
 * a genuine identity collision -- the one case where saving would present
 * a claim as confirmed that the sources themselves dispute. Owner may
 * override explicitly. Everything else is saveable with its status shown. */
export function saveBlockReason(profile: ResearchProfile): string | null {
  if (profile.identity.identityConfidence === "conflict") return "First-party sources name different businesses for this account. Resolve which one it is (edit the business name or remove the wrong source) before saving.";
  return null;
}
