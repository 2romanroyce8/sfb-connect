import type { Candidate, FeedTarget, IdentityLabel, QualityFlag, RawFinding } from "./types";
import { normalizeState, US_STATE_CODES, stateName } from "./sources/rss";
import { canonicalDomain } from "../normalize";
import { classifyDiscoveryResult } from "../discovery/resultClassifier";
import { isGenericServicePhrase, looksLikePersonName, normalizeBusinessName, normalizePhoneE164 } from "../reconcile";

/**
 * Data-quality layer for feed findings. Every rule from the audit lives here:
 *  - city + state required, US-only (50 states + DC), state must match target
 *  - national chains / franchises / manufacturers / distributors are not prospects
 *  - directories, aggregators, social and news hosts are not business websites
 *  - junk names (generic service phrases, person names, too short) are dropped
 *  - identity label is honest: a feed finding is never "confirmed"
 * Flags are recorded, not silently applied, so the drop reasons are auditable.
 */

// National chains, franchises, manufacturers, distributors, marketplaces —
// none of them is a locally-owned prospect. Matched on normalized name AND domain.
export const CHAIN_BRANDS = [
  "home depot", "lowes", "lowe's", "menards", "sears", "angi", "angie's list", "homeadvisor", "thumbtack", "porch", "houzz", "networx", "modernize", "nextdoor", "yelp",
  "mr roof", "mr. roof", "erie home", "erie construction", "power home remodeling", "long roofing", "long home products", "tecta america", "centimark", "nations roof", "baker roofing", "roofing corp of america", "rca",
  "gaf", "owens corning", "certainteed", "iko", "tamko", "atlas roofing", "malarkey", "firestone building products", "carlisle syntec", "johns manville", "polyglass", "boral", "eagle roofing products", "westlake royal",
  "abc supply", "beacon", "beacon building products", "srs distribution", "allied building products", "roofing supply group", "lansing building products", "us lbm", "builders firstsource", "84 lumber",
  "window world", "renewal by andersen", "andersen windows", "pella", "leaffilter", "leaf filter", "leafguard", "bath fitter", "re-bath", "mr handyman", "mr. handyman", "neighborly", "servicemaster", "servpro", "belfor", "paul davis", "puroclean", "1-800-", "aspen contracting", "roofsimple",
  "roofing.com", "roofer.com", "roofingcalculator", "fixr", "bbb", "better business bureau", "chamber of commerce",
];
const CHAIN_DOMAINS = ["homedepot.com", "lowes.com", "angi.com", "homeadvisor.com", "thumbtack.com", "porch.com", "houzz.com", "networx.com", "modernize.com", "gaf.com", "owenscorning.com", "certainteed.com", "iko.com", "tamko.com", "abcsupply.com", "becn.com", "srsdistribution.com", "tectaamerica.com", "centimark.com", "nationsroof.com", "eriehome.com", "powerhrg.com", "longhomeproducts.com", "windowworld.com", "renewalbyandersen.com", "leaffilter.com", "servpro.com", "belfor.com", "pauldavis.com", "neighborly.com", "bbb.org", "roofing.com", "roofer.com", "fixr.com", "mrhandyman.com", "bathfitter.com"];
const FRANCHISE_WORDS = /\b(franchise|franchisee|franchising|nationwide|national brand|locations nationwide|corporate headquarters)\b/i;
const NEWS_HOSTS = /(\.|^)(roofingcontractor\.com|roofingmagazine\.com|constructiondive\.com|bizjournals\.com|prnewswire\.com|businesswire\.com|globenewswire\.com|patch\.com|news\.google\.com|yahoo\.com|msn\.com)$/i;
const GENERIC_TITLE_SEGMENTS = /^(home|homepage|welcome|official site|official website|index|main|untitled|about( us)?|contact( us)?|services|roofing services|roof repair|roofing contractor|roofing company|best roofers?( in [a-z ,]+)?|top \d+.*)$/i;

export const isChainOrFranchise = (name: string, domain: string | null, text: string): boolean => {
  const n = normalizeBusinessName(name).toLowerCase();
  if (CHAIN_BRANDS.some((b) => n === b || n.startsWith(b + " ") || n.endsWith(" " + b) || n.includes(" " + b + " "))) return true;
  if (domain && CHAIN_DOMAINS.some((d) => domain === d || domain.endsWith("." + d))) return true;
  return FRANCHISE_WORDS.test(text) && /\b(franchise|franchisee)\b/i.test(text);
};

export const isDirectoryOrAggregatorUrl = (url: string | null): boolean => {
  if (!url) return false;
  const host = canonicalDomain(url);
  if (host && NEWS_HOSTS.test(host)) return true;
  const cls = classifyDiscoveryResult({ title: null, url, description: null, provider: "exa", rank: null, discoveredAt: "" });
  return cls === "directory" || cls === "social" || cls === "infra";
};

export const isJunkName = (name: string): boolean => {
  const n = name.trim();
  if (n.length < 3 || n.length > 90) return true;
  if (!/[a-z]/i.test(n)) return true;
  if (GENERIC_TITLE_SEGMENTS.test(n)) return true;
  if (isGenericServicePhrase(n)) return true;
  if (looksLikePersonName(n)) return true;
  if (/^\d+ (best|top)\b/i.test(n) || /\b(near me|reviews?|ratings?|cost|prices?|guide|how to|what is)\b/i.test(n)) return true;
  return false;
};

/** "ABC Roofing | Tampa's Trusted Roofer" → "ABC Roofing"; "Home - ABC Roofing" → "ABC Roofing". */
export function nameFromTitle(title: string, domain: string | null): string | null {
  const segs = title.split(/\s+[|\-–—:·»]+\s+|\s+\|\s*/).map((s) => s.trim()).filter(Boolean);
  const ok = segs.filter((s) => !GENERIC_TITLE_SEGMENTS.test(s) && !isGenericServicePhrase(s) && s.length >= 3 && s.length <= 60);
  if (ok.length) {
    // Prefer the segment that shares a token with the domain (the brand), else the first.
    const d = (domain ?? "").split(".")[0].toLowerCase();
    const branded = d.length >= 4 ? ok.find((s) => s.toLowerCase().replace(/[^a-z0-9]/g, "").includes(d.replace(/[^a-z0-9]/g, "").slice(0, 6))) : undefined;
    return (branded ?? ok[0]).trim();
  }
  // Only a title with NO usable segment at all falls back to the domain; a
  // title that is purely generic ("Best Roofers in Tampa") names no business.
  if (segs.length) return null;
  if (domain) {
    const base = domain.split(".")[0];
    if (base.length >= 4) return base.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return null;
}

const STATE_ALTERNATION = US_STATE_CODES.map((c) => `${c}|${stateName(c).replace(/ /g, "\\s+")}`).join("|");
const CITY_STATE_RE = new RegExp(`\\b([A-Z][a-zA-Z.'-]+(?:\\s+[A-Z][a-zA-Z.'-]+){0,2}),\\s*(${STATE_ALTERNATION})\\b(?![a-z])`, "g");
const PHONE_RE = /(?:\+?1[\s.-]?)?\(?\b([2-9]\d{2})\)?[\s.-]?([2-9]\d{2})[\s.-]?(\d{4})\b/;

/** City/state from the text: the target's own city wins if it appears; otherwise the first "City, ST" pair. */
export function extractCityState(text: string, target: FeedTarget): { city: string | null; state: string | null } {
  if (new RegExp(`\\b${target.city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text)) return { city: target.city, state: target.state };
  const m = [...text.matchAll(CITY_STATE_RE)][0];
  if (m) return { city: m[1], state: normalizeState(m[2]) };
  return { city: null, state: null };
}
export const extractPhone = (text: string): string | null => {
  const m = text.match(PHONE_RE);
  return m ? normalizePhoneE164(`${m[1]}${m[2]}${m[3]}`) : null;
};

/** Business names in prose (RSS items): capitalized runs ending in a business suffix or trade word. */
const PROSE_NAME_RE = /\b((?:(?:[A-Z][A-Za-z'.]*|&)\s+){1,5}(?:Roofing|Roofers|Exteriors|Construction|Contractors?|Builders|Restoration|Remodeling|HVAC|Plumbing|Electric|Services|Solutions|Systems|Group|LLC|Inc\.?|Co\.|Corp\.?|Company))\b/g;
export function extractProseNames(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(PROSE_NAME_RE)) {
    const n = m[1].replace(/\s+/g, " ").trim();
    if (!isJunkName(n) && n.split(" ").length >= 2) out.add(n);
  }
  return [...out].slice(0, 5);
}

export function labelIdentity(c: { name: string; canonicalDomain: string | null; phoneE164: string | null; city: string | null; sourceKind: string }): IdentityLabel {
  if (c.sourceKind === "rss" || !c.canonicalDomain) return c.phoneE164 ? "name_only" : "unverified";
  const tokens = normalizeBusinessName(c.name).toLowerCase().split(/\s+/).filter((t) => t.length >= 4 && !["roofing", "roof", "roofers", "company", "contractor", "contractors", "services", "construction", "exteriors", "solutions", "group"].includes(t));
  const base = c.canonicalDomain.split(".")[0].toLowerCase();
  const domainNamesBusiness = tokens.some((t) => base.includes(t.replace(/[^a-z0-9]/g, "")));
  if (domainNamesBusiness && (c.phoneE164 || c.city)) return "corroborated";
  return "name_only";
}

export const dedupeKeyFor = (c: { canonicalDomain: string | null; phoneE164: string | null; name: string; city: string | null; state: string | null }) =>
  c.canonicalDomain ? `d:${c.canonicalDomain}` : c.phoneE164 ? `p:${c.phoneE164}` : `n:${normalizeBusinessName(c.name).toLowerCase()}|${(c.city ?? "").toLowerCase()}|${(c.state ?? "").toUpperCase()}`;

/** RawFinding → zero or more Candidates with quality flags applied (nothing dropped yet). */
export function toCandidates(raw: RawFinding, target: FeedTarget): Candidate[] {
  const text = `${raw.title} ${raw.snippet}`;
  const base = { snippet: raw.snippet.slice(0, 600), sourceKind: raw.sourceKind, sourceUrl: raw.sourceUrl, publishedAt: raw.publishedAt, targetId: raw.targetId, category: target.vertical };
  const geo = extractCityState(text, target);
  const phone = extractPhone(text);

  const finish = (name: string, website: string | null): Candidate => {
    const domain = website ? canonicalDomain(website) : null;
    const flags: QualityFlag[] = [];
    if (!geo.city || !geo.state) flags.push("missing_city_state");
    else if (!US_STATE_CODES.includes(geo.state)) flags.push("non_us");
    else if (geo.state !== target.state.toUpperCase()) flags.push("state_mismatch");
    if (isChainOrFranchise(name, domain, text)) flags.push("chain_or_franchise");
    if (website && isDirectoryOrAggregatorUrl(website)) flags.push("directory_or_aggregator");
    if (isJunkName(name)) flags.push("junk_name");
    const c = { name, website, canonicalDomain: domain, phoneE164: phone, city: geo.city, state: geo.state, ...base };
    return { ...c, identityLabel: labelIdentity(c), dedupeKey: dedupeKeyFor(c), flags };
  };

  if (raw.sourceKind === "exa") {
    const domain = raw.url ? canonicalDomain(raw.url) : null;
    const name = nameFromTitle(raw.title, domain);
    if (!name) return [];
    return [finish(name, raw.url)];
  }
  return extractProseNames(text).map((n) => finish(n, null));
}

export const HARD_DROP: QualityFlag[] = ["missing_city_state", "non_us", "state_mismatch", "chain_or_franchise", "directory_or_aggregator", "junk_name", "duplicate_in_batch", "duplicate_in_crm", "duplicate_prior_finding"];
export const isAccepted = (c: Candidate) => c.flags.every((f) => !HARD_DROP.includes(f));
