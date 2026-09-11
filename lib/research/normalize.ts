// Deterministic normalization — no AI involved. Getting "company.com" and
// "https://www.company.com/" to compare equal is what lets the identity
// resolver and evidence validator work at all.

export function normalizeUrl(input: string): string {
  let t = input.trim();
  if (!/^https?:\/\//i.test(t)) t = `https://${t}`;
  try {
    const u = new URL(t);
    u.hash = "";
    return u.toString();
  } catch {
    return t;
  }
}

// Domain-identity key: "what website/business does this URL belong to."
// Correct for entity resolution, official-site matching, and per-domain
// budgeting/rate limits -- WRONG for crawl-frontier dedupe (two different
// pages on the same domain must not collapse to one key). See pageKey()
// below for that. Kept exactly as-is; every existing caller here already
// wants domain-level identity.
export function canonicalDomain(url: string): string | null {
  try {
    const u = new URL(normalizeUrl(url));
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

// Semantic alias for canonicalDomain() at call sites that are explicitly
// about domain-level identity (crawl budgets, official-site matching) --
// same function, clearer name alongside pageKey() below.
export const domainKey = canonicalDomain;

const TRACKING_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid", "fbadid", "mc_cid", "mc_eid", "igshid", "msclkid"];

// Crawl-frontier identity key: "have we already queued/fetched this exact
// meaningful page." Distinct from canonicalDomain() on purpose --
// /about and /contact on the same domain MUST produce different keys, or
// the discovery graph silently stops crawling a site after its first page
// (the bug this function fixes). Normalizes protocol/host casing, optional
// www, trailing slash, fragment, known tracking params, and query-param
// order -- but preserves every OTHER path segment and query param, since
// ?id=123 vs ?id=456 are genuinely different pages.
export function pageKey(input: string): string {
  let u: URL;
  try {
    u = new URL(normalizeUrl(input));
  } catch {
    return input.trim().toLowerCase();
  }
  u.hash = "";
  u.hostname = u.hostname.replace(/^www\./, "").toLowerCase();
  for (const param of TRACKING_PARAMS) u.searchParams.delete(param);
  u.searchParams.sort();
  let pathname = u.pathname || "/";
  if (pathname.length > 1 && pathname.endsWith("/")) pathname = pathname.slice(0, -1);
  return `${u.protocol}//${u.hostname}${pathname}${u.search}`;
}

export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 10 && digits.length <= 15) return `+${digits}`;
  return null;
}

export function isPlausibleEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && !/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(value);
}

const SOCIAL_HOSTS: Record<string, "facebook" | "instagram" | "tiktok" | "linkedin" | "youtube" | "x" | "whatsapp"> = {
  "facebook.com": "facebook",
  "fb.com": "facebook",
  "instagram.com": "instagram",
  "tiktok.com": "tiktok",
  "linkedin.com": "linkedin",
  "youtube.com": "youtube",
  "youtu.be": "youtube",
  "twitter.com": "x",
  "x.com": "x",
  "wa.me": "whatsapp",
};

// Content-delivery / internal-infrastructure hosts that must NEVER be
// treated as a business's official website or a usable social profile link,
// even though they live under a social platform's umbrella. A URL like
// static.xx.fbcdn.net is an image byte stream, not a business's website --
// this is the fix for that exact bug (it was previously unfiltered and
// could win the "official website" vote by link-frequency alone).
const INFRA_HOST_SUFFIXES = [
  "fbcdn.net",
  "fbsbx.com",
  "cdninstagram.com",
  "akamaihd.net",
  "tiktokcdn.com",
  "tiktokcdn-us.com",
  "tiktokv.com",
  "ibyteimg.com",
  "ibytedtos.com",
  "muscdn.com",
  "byteoversea.com",
];

// Subdomains of an otherwise-legitimate social root domain that are
// internal API / business-tooling / link-shim endpoints, not a public
// profile page a customer could actually visit.
const INFRA_SUBDOMAIN_PREFIXES: Record<string, string[]> = {
  "facebook.com": ["graph", "l", "lm", "business", "developers", "about", "help", "static", "scontent"],
  "instagram.com": ["graph", "developers", "business", "help", "about", "static"],
  "tiktok.com": ["ads", "business", "developers", "help", "about"],
};

function isInfraHost(url: string): boolean {
  const domain = canonicalDomain(url);
  if (!domain) return false;
  if (INFRA_HOST_SUFFIXES.some((suf) => domain === suf || domain.endsWith(`.${suf}`))) return true;
  for (const [root, prefixes] of Object.entries(INFRA_SUBDOMAIN_PREFIXES)) {
    if (domain === root) continue; // the bare root domain is a legitimate profile host
    if (domain.endsWith(`.${root}`)) {
      const sub = domain.slice(0, -(root.length + 1));
      if (prefixes.some((p) => sub === p || sub.startsWith(`${p}.`))) return true;
    }
  }
  return false;
}

/** True for CDN/asset/tracking/internal-tooling hosts that must never be
 * stored in a business's website or social-profile fields. */
export function isInfrastructureUrl(url: string): boolean {
  return isInfraHost(url);
}

function matchesSocialHost(domain: string): boolean {
  if (domain in SOCIAL_HOSTS) return true;
  return Object.keys(SOCIAL_HOSTS).some((root) => domain.endsWith(`.${root}`));
}

function socialPlatformForDomain(domain: string) {
  if (domain in SOCIAL_HOSTS) return SOCIAL_HOSTS[domain];
  for (const root of Object.keys(SOCIAL_HOSTS)) {
    if (domain.endsWith(`.${root}`)) return SOCIAL_HOSTS[root];
  }
  return null;
}

// Any public bio-link hub, not just Linktree. Kept as an explicit host list
// per the "known providers" rule — genuinely unknown hub providers still get
// caught by the DeepResearchCoordinator's verification pass, which doesn't
// depend on a provider allowlist (it looks at page shape, not just domain).
const BIO_LINK_HOSTS = [
  "linktr.ee",
  "beacons.ai",
  "campsite.bio",
  "bio.link",
  "carrd.co",
  "solo.to",
  "taplink.cc",
  "linkin.bio",
  "msha.ke",
  "stan.store",
  "withkoji.com",
  "koji.to",
];

export type LinkClassification =
  | { kind: "social"; platform: "facebook" | "instagram" | "tiktok" | "linkedin" | "youtube" | "x" | "whatsapp" }
  | { kind: "whatsapp" }
  | { kind: "booking" }
  | { kind: "linktree" }
  | { kind: "infra" }
  | { kind: "other" };

export function classifyLink(url: string): LinkClassification {
  const domain = canonicalDomain(url) || "";
  // Infra/CDN/tooling hosts are checked first and unconditionally -- they
  // must never fall through into "social" or "other" (which is what makes
  // "other" eligible to become the official-website guess).
  if (isInfraHost(url)) return { kind: "infra" };
  if (domain === "wa.me" || domain === "api.whatsapp.com") return { kind: "whatsapp" };
  if (matchesSocialHost(domain)) {
    const platform = socialPlatformForDomain(domain);
    if (platform) return { kind: "social", platform };
  }
  if (BIO_LINK_HOSTS.includes(domain)) return { kind: "linktree" };
  if (["calendly.com", "squareup.com", "square.site", "booksy.com", "acuityscheduling.com", "setmore.com"].includes(domain)) return { kind: "booking" };
  return { kind: "other" };
}

export function socialPlatformFor(url: string) {
  if (isInfraHost(url)) return null;
  const domain = canonicalDomain(url) || "";
  return socialPlatformForDomain(domain);
}

export function isSocialOrDirectoryHost(url: string): boolean {
  // Infra hosts are folded in here too: this function's only caller
  // (LinkDiscoveryService) uses it to decide "should this domain be
  // eligible as the official-website guess?" -- CDN/tooling hosts must
  // always answer no to that question, same as social/directory hosts.
  if (isInfraHost(url)) return true;
  const domain = canonicalDomain(url) || "";
  return matchesSocialHost(domain) || ["google.com", "yelp.com", "bbb.org", "yellowpages.com"].includes(domain);
}
