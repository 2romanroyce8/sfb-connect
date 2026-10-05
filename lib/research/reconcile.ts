import type { BusinessGraph, Candidate, ContactMethodRecord, LocationRecord, SocialProfileRecord, SourceLogEntry } from "./types";
import { canonicalDomain, classifyLink } from "./normalize";

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
  fetchStatus: "fetched" | "blocked_login_wall" | "unreachable" | "skipped_priority" | "skipped_budget" | "generic_platform_shell" | "not_attempted";
  skipReason: string | null;
  profileType: ProfileType | null;
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

/** Facebook-only: what kind of account is this? Conservative -- anything we
 * can't tell from the URL shape is UNKNOWN, and the engine's own name
 * heuristics decide PERSONAL_PROFILE vs BUSINESS_PAGE downstream. */
export function detectFacebookProfileType(seedUrl: string, businessName: string | null): ProfileType {
  const u = seedUrl.toLowerCase();
  if (!/facebook\.com|fb\.com/.test(u)) return "UNKNOWN";
  if (/\/groups\//.test(u)) return "GROUP";
  if (/\/events\//.test(u)) return "EVENT";
  if (/\/pages\//.test(u)) return "BUSINESS_PAGE";
  if (/\/people\//.test(u)) return "PUBLIC_PROFILE";
  if (/profile\.php\?id=/.test(u)) {
    // Numeric profile ids are usually personal; a business-looking name
    // (contains a trade/LLC token) tips it to PUBLIC_PROFILE, never to
    // BUSINESS_PAGE -- we can't prove page-ness from a profile id.
    return businessName && /\b(llc|inc|co|services?|removal|hauling|roofing|hvac|plumbing|cleaning|landscap|repair|construction|auto|salon|studio|shop|store|cafe|restaurant|bar|grill|dental|law|realty|photography)\b/i.test(businessName) ? "PUBLIC_PROFILE" : "PERSONAL_PROFILE";
  }
  // Vanity URL (facebook.com/<slug>): overwhelmingly a Page. A "First Last"
  // name heuristic was tried here and misfired on ordinary two-word
  // business names ("Junk Seekers") on the first live run -- the name alone
  // is not evidence of a personal account, so we don't claim it. Personal
  // vs public profile is only inferred from numeric profile.php ids above;
  // the identity gate's corroboration requirement covers the residual risk.
  return "BUSINESS_PAGE";
}

// ---------- link classification -> SourceEntity (Spec §4) ----------

const BUSINESS_PROFILE_HOSTS = ["yelp.com", "bbb.org", "tripadvisor.com", "angi.com", "thumbtack.com", "homeadvisor.com", "houzz.com", "porch.com", "nextdoor.com", "yellowpages.com", "mapquest.com"];
const IGNORE_PATTERNS = [/fbclid=/, /utm_/, /\/login/, /\/signup/, /\/ads?\//, /doubleclick/, /googletagmanager/, /amazon\.com/, /\/sharer/, /\/share\?/, /\/help\//, /\/privacy/, /\/terms/, /\.(ico|png|jpe?g|gif|svg|webp|webmanifest|xml|json|css|js)(\?|$)/, /\/manifest/, /\/opensearch/, /\/data\//];

/** A social-platform URL is only a first-party source when its path is
 * shaped like a profile/page/channel. Everything else on the platform
 * (/t/contact_us, /creators, /new, /howyoutubeworks, favicon, manifests,
 * tv.youtube.com/learn/...) is platform navigation the crawler picked up
 * from the page chrome -- observed live on the first production run. */
export function isSocialProfilePath(url: string, platform: string): boolean {
  let u: URL;
  try { u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`); } catch { return false; }
  const host = u.hostname.toLowerCase();
  const path = u.pathname.replace(/\/+$/, "");
  const segs = path.split("/").filter(Boolean);
  if (host.startsWith("tv.") || host.startsWith("music.") || host.startsWith("studio.") || host.startsWith("developers.") || host.startsWith("business.") || host.startsWith("about.")) return false;
  switch (platform) {
    case "facebook":
      if (/^\/profile\.php$/.test(path) && u.searchParams.has("id")) return true;
      if (segs[0] === "pages" || segs[0] === "people") return segs.length >= 2;
      return segs.length === 1 && !FB_RESERVED.has(segs[0].toLowerCase());
    case "instagram":
    case "tiktok":
    case "x":
      return segs.length === 1 && !GENERIC_RESERVED.has(segs[0].toLowerCase().replace(/^@/, ""));
    case "youtube":
      if (segs.length === 1 && segs[0].startsWith("@")) return true;
      return segs.length >= 2 && ["channel", "c", "user"].includes(segs[0]);
    case "linkedin":
      return segs.length >= 2 && ["company", "in", "school", "showcase"].includes(segs[0]);
    default:
      return segs.length === 1;
  }
}
const PLATFORM_BRAND_HANDLES = new Set(["youtube", "youtubecreators", "teamyoutube", "instagram", "facebook", "facebookapp", "meta", "tiktok", "tiktok_us", "twitter", "x", "linkedin", "google", "googlemaps", "whatsapp", "pinterest", "snapchat", "threads", "yelp", "nextdoor", "linktree", "linktr_ee"]);
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
    const { linkType, priority } = classifyLinkType(entry.url, isOfficialDomain);
    // Priority 0 = noise (tracking params, share links, platform nav). Even
    // if the crawler touched it, it is not a source of truth and must not
    // count toward sources_fetched.
    const fetchStatus: SourceEntity["fetchStatus"] =
      priority === 0 ? "skipped_priority"
      : entry.genericPlatformContent ? "generic_platform_shell"
      : entry.fetchStatus === "ok" ? "fetched"
      : /login|wall|blocked/i.test(entry.blockedReason || "") ? "blocked_login_wall"
      : "unreachable";
    // First-party = seed itself, same domain as official site, or
    // discovered directly from a first-party page via its own links.
    const fromOrdinal = entry.discoveredFrom ? ordinalByUrl.get(entry.discoveredFrom) ?? null : null;
    const parentIsFirstParty = fromOrdinal ? out.find((s) => s.ordinal === fromOrdinal)?.isFirstParty ?? false : false;
    const isFirstParty = entry.discoveryMethod === "seed" || isOfficialDomain || (priority === 1 && (parentIsFirstParty || entry.discoveryMethod === "bio_link" || entry.discoveryMethod === "social_link" || entry.discoveryMethod === "website_crawl"));
    // A platform shell we couldn't actually read yields no evidence, so it
    // can't be "likely first-party" on its own (unless it IS the seed).
    const association: Association =
      priority === 0 ? "not_applicable"
      : isFirstParty && (entry.discoveryMethod === "seed" || isOfficialDomain) ? "confirmed_first_party"
      : fetchStatus === "generic_platform_shell" || fetchStatus === "blocked_login_wall" ? "uncertain"
      : isFirstParty ? "likely_first_party"
      : priority === 3 ? "rejected_unrelated"
      : "uncertain";
    out.push({
      ordinal: i + 1,
      url: entry.url,
      canonicalUrl: entry.url,
      platform: platformOf(entry.url),
      linkType,
      priority,
      isFirstParty,
      association,
      discoveredFromOrdinal: fromOrdinal,
      discoveryMethod: entry.discoveryMethod,
      depth: null,
      fetchStatus,
      skipReason: priority === 0 ? `ignored: ${linkType}` : entry.blockedReason ?? null,
      profileType: null,
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

function reconcileIdentity(graph: BusinessGraph, seedUrl: string, website: FieldValue<string>, phones: PhoneValue[]): ResearchProfile["identity"] {
  const name = graph.businessName;
  const profileType = detectFacebookProfileType(seedUrl, name?.value ?? null);
  const notes: string[] = [];
  let identityConfidence: IdentityConfidence = "not_found";
  let status: FieldStatus = "NOT_FOUND";

  if (name?.value) {
    // Strong corroboration = the name appears alongside a confirmed website
    // domain or a first-party phone. Name alone (strength<=1) is UNCERTAIN.
    const corroborated = (website.status === "CONFIRMED") || phones.some((p) => p.status === "CONFIRMED" || p.status === "CONFLICT");
    if (name.strength >= 3 && corroborated) { identityConfidence = "confirmed"; status = "CONFIRMED"; }
    else if (name.strength >= 2 || corroborated) { identityConfidence = "uncertain"; status = "UNCERTAIN"; notes.push("Business name found but only weakly corroborated by a second signal (domain/phone)."); }
    else { identityConfidence = "uncertain"; status = "UNCERTAIN"; notes.push("Business name comes from a single weak source."); }
  } else {
    notes.push("No business name could be established from public sources.");
  }

  if (profileType === "PERSONAL_PROFILE") {
    identityConfidence = identityConfidence === "confirmed" ? "uncertain" : identityConfidence;
    notes.push("Seed appears to be a personal Facebook profile, not a business Page. Identity is capped at UNCERTAIN until a business entity is corroborated by a second source.");
  }
  if (profileType === "GROUP" || profileType === "EVENT") {
    identityConfidence = "uncertain";
    notes.push(`Seed is a Facebook ${profileType.toLowerCase()}, not a business account.`);
  }

  const nameRef = name ? [ref(name.sourceUrl)] : [];
  return {
    businessName: { value: name?.value ?? null, status, confidence: toConfidence(status, nameRef.length, name && name.strength >= 3 ? 1 : 0), sources: nameRef },
    displayNames: name?.value ? [{ value: name.value, sources: nameRef }] : [],
    profileType,
    category: { value: graph.category, status: graph.category ? "INFERRED" : "NOT_FOUND", confidence: "LOW", sources: [] },
    description: { value: graph.description, status: graph.description ? "CONFIRMED" : "NOT_FOUND", confidence: graph.description ? "MEDIUM" : "LOW", sources: [] },
    identityConfidence,
    identityNotes: notes,
  };
}

// ---------- sales intelligence (Spec §10) -- template-driven, facts only ----------

function buildSalesIntelligence(p: Omit<ResearchProfile, "salesIntelligence">): SalesIntelligence {
  const name = p.identity.businessName.value ?? "This business";
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
  if (p.identity.identityConfidence !== "confirmed") callPrep.push("Identity is not fully confirmed -- verify you have the right business in the first 10 seconds of the call.");
  for (const w of weaknesses.slice(0, 3)) callPrep.push(`Observed gap: ${w.toLowerCase()}.`);
  if (p.conflicts.length) callPrep.push("Ask which phone number is the main line -- sources disagree.");

  // schema.org types arrive as "LocalBusiness"/"HomeAndConstructionBusiness";
  // humanize and avoid "a localbusiness business".
  const humanCat = cat ? cat.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().replace(/\s*business$/, "").trim() : null;
  const summary = `${name}${humanCat ? ` appears to operate as a ${humanCat} business` : ""}${city ? ` in ${city}` : ""}. ${p.website.status === "CONFIRMED" ? "Official website confirmed. " : ""}${howTheySell.length ? `Visible channels: ${Array.from(new Set(howTheySell)).join(", ")}.` : "No confirmed online channels beyond the seed source."}`.trim();

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
  const sources = buildSourceEntities(graph, officialDomain);
  const firstPartyUrls = new Set(sources.filter((s) => s.isFirstParty).map((s) => s.url));
  // The seed and the official site are first-party by definition even if
  // the source log recorded them under a different URL form.
  firstPartyUrls.add(seedUrl);
  if (websiteCandidate?.value) firstPartyUrls.add(websiteCandidate.value);

  const website: FieldValue<string> = websiteCandidate?.value
    ? { value: websiteCandidate.value, status: websiteCandidate.status === "verified" ? "CONFIRMED" : websiteCandidate.status === "conflict" ? "CONFLICT" : "UNCERTAIN", confidence: websiteCandidate.status === "verified" ? "HIGH" : "LOW", sources: [ref(websiteCandidate.sourceUrl)] }
    : { value: null, status: graph.websiteDiscovery?.status === "discovery_unavailable" ? "INACCESSIBLE" : "NOT_FOUND", confidence: "LOW", sources: [] };

  const { phones, conflicts } = reconcilePhones(graph.contactMethods, firstPartyUrls);
  const emails = reconcileEmails(graph.contactMethods, firstPartyUrls);
  const channels = graph.contactMethods
    .filter((c) => c.value && ["whatsapp", "booking", "contact_form"].includes(c.type))
    .map((c) => ({ kind: c.type, value: c.value!, sources: [ref(c.sourceUrl)] }));

  const identity = reconcileIdentity(graph, seedUrl, website, phones);

  const physical = graph.locations.filter((l) => l.locationType === "primary" || l.locationType === "branch");
  const serviceArea = graph.locations.filter((l) => l.locationType === "service_area");

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

  const limitations: Limitation[] = [];
  if (identity.identityConfidence !== "confirmed") limitations.push({ code: "IDENTITY_NOT_CONFIRMED", message: "Business identity could not be confirmed with two independent signals." });
  if (website.status === "INACCESSIBLE") limitations.push({ code: "DISCOVERY_UNAVAILABLE", message: "Wider-web website discovery did not run (no search provider configured)." });
  const blocked = sources.filter((s) => s.fetchStatus === "blocked_login_wall" || s.fetchStatus === "generic_platform_shell");
  if (blocked.length) limitations.push({ code: "SOURCES_INACCESSIBLE", message: `${blocked.length} source(s) were login-walled or returned platform boilerplate and could not be read.` });

  const checks: Record<string, boolean> = {
    identity: identity.identityConfidence === "confirmed",
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

  const base: Omit<ResearchProfile, "salesIntelligence"> = {
    identity,
    contacts: { phones, emails, channels },
    locations: { physical, serviceArea },
    website,
    socialProfiles,
    business: { services: graph.services, pricing: { note: "NO_PUBLIC_PRICING_FOUND" } },
    sources,
    conflicts,
    limitations,
    metrics: {
      researchConfidencePct: Math.round((100 * earned) / totalWeight),
      fieldsVerified,
      fieldsTotal: Object.keys(checks).length,
      sourcesChecked: sources.length,
      sourcesFetched: sources.filter((s) => s.fetchStatus === "fetched").length,
      researchStatus: limitations.length ? "completed_with_limitations" : "complete",
    },
  };
  return { ...base, salesIntelligence: buildSalesIntelligence(base) };
}

/** Spec §3 hard rule: block Save when identity can't be trusted. Owner may
 * override explicitly; reps may not. */
export function saveBlockReason(profile: ResearchProfile): string | null {
  if (profile.identity.profileType === "PERSONAL_PROFILE" && profile.identity.identityConfidence !== "confirmed") return "Seed looks like a personal profile and the business identity is not corroborated by a second source.";
  if (profile.identity.identityConfidence === "conflict") return "Sources disagree about which business this is.";
  if (profile.identity.identityConfidence === "not_found") return "No business identity could be established.";
  if (profile.identity.identityConfidence === "uncertain" && profile.metrics.researchConfidencePct < 60) return `Identity is uncertain and research confidence is only ${profile.metrics.researchConfidencePct}%.`;
  return null;
}
