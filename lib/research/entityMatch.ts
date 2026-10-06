import { canonicalDomain, isSocialProfilePath, classifyLink } from "./normalize";

// ============================================================
// SEED ENTITY LOCK + ENTITY MATCHING
//
// The URL the user gives us IS the entity. The engine first resolves what
// that exact URL represents (SeedEntity), locks it, and then evaluates every
// discovered source AGAINST it before that source may (a) be expanded,
// (b) become the official website, or (c) contribute a single field.
//
// Discovery != association. Finding a URL means nothing until this module
// says how it relates to the seed:
//   MATCHED         the seed itself, the trusted official site, a page that
//                   links to the exact seed, or a name+contact match
//   PROBABLE_MATCH  the account's own outbound link, or a name OR contact
//                   match with the seed
//   POSSIBLE_MATCH  linked from a matched non-platform page (e.g. the
//                   official site -> a directory listing)
//   UNVERIFIED      reached by search / gap analysis / QA with no evidence
//   REJECTED        platform infrastructure, navigation or boilerplate; a
//                   lookup/spam site; or a page whose published identity is
//                   a different, unrelated entity
// Only MATCHED and PROBABLE_MATCH sources may contribute fields. REJECTED
// and UNVERIFIED sources are logged with the reason and are dead ends for
// crawling. This is the rule that stops a Facebook seed for "Supreme Air
// LLC" from being renamed "How Youtube Works" by a page five hops away.
// ============================================================

export type EntityMatchStatus = "MATCHED" | "PROBABLE_MATCH" | "POSSIBLE_MATCH" | "UNVERIFIED" | "CONFLICTING" | "REJECTED";
export type EntityMatch = { status: EntityMatchStatus; reasons: string[] };

export type SeedEntity = {
  url: string;
  canonicalUrl: string;
  platform: string; // facebook | instagram | linkedin | x | tiktok | website | ...
  platformId: string | null; // e.g. Facebook numeric id 61574342053650
  username: string | null; // vanity handle / slug
  displayName: string | null;
  entityHint: "business" | "person" | "unknown";
  phones: string[]; // E.164-ish digits found on the seed page itself
  emails: string[];
  domains: string[]; // outbound non-social, non-infra domains the seed page itself links to
  resolved: boolean; // did the seed page (or index recovery) yield an identity
  resolvedFrom: "page" | "index" | "url" | "none";
};

export const PLATFORM_CHROME_SOURCES: ReadonlySet<string> = new Set(["linkedin", "x", "tiktok", "youtube"]);

export function normalizeName(v: string): string {
  return v.toLowerCase().replace(/&amp;/g, "&").replace(/\b(llc|inc|co|corp|corporation|company|ltd|the)\b\.?/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}
export function digitsOf(v: string): string { const d = v.replace(/\D/g, ""); return d.length === 11 && d.startsWith("1") ? d.slice(1) : d; }

/** Facebook numeric id from any of its URL shapes. */
export function facebookIdFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const id = u.searchParams.get("id");
    if (/^\/profile\.php/.test(u.pathname) && id) return id;
    const m = u.pathname.match(/\/(?:people|pages)\/[^/]+\/(\d{6,})\/?/) || u.pathname.match(/\/p\/[^/]*?-(\d{6,})\/?/);
    return m ? m[1] : null;
  } catch { return null; }
}

/** Does a URL point at the exact seed account (any URL shape)? */
export function urlNamesSeed(url: string, seed: SeedEntity): boolean {
  const norm = (u: string) => u.toLowerCase().replace(/^https?:\/\/(www\.|m\.|mbasic\.|mobile\.)?/, "").replace(/\/+$/, "").replace(/\?.*$/, "");
  if (norm(url) === norm(seed.url) || norm(url) === norm(seed.canonicalUrl)) return true;
  if (seed.platform === "facebook" && seed.platformId) { const id = facebookIdFromUrl(url); if (id && id === seed.platformId) return true; }
  if (seed.username) {
    try {
      const u = new URL(url); const host = u.hostname.toLowerCase().replace(/^(www|m|mobile)\./, "");
      const seedHost = new URL(seed.canonicalUrl).hostname.toLowerCase().replace(/^(www|m|mobile)\./, "");
      const first = u.pathname.split("/").filter(Boolean)[0]?.toLowerCase().replace(/^@/, "");
      if (host === seedHost && first === seed.username.toLowerCase().replace(/^@/, "")) return true;
    } catch { /* ignore */ }
  }
  return false;
}

/** Platform infrastructure / navigation / boilerplate: never a business source. */
export function isPlatformBoilerplateUrl(url: string): boolean {
  const cls = classifyLink(url);
  if (cls.kind === "infra") return true;
  if (cls.kind === "social") return !isSocialProfilePath(url, (cls as { platform: string }).platform);
  if (/\.(ico|png|jpe?g|gif|svg|webp|webmanifest|xml|json|css|js)(\?|$)/i.test(url)) return true;
  if (/\/(manifest|opensearch|feeds?)\b/i.test(url)) return true;
  return false;
}

export type PageFacts = {
  url: string;
  sourceType: string;
  isSeed: boolean;
  discoveryMethod: string | null;
  parentStatus: EntityMatchStatus | null;
  parentIsChrome: boolean;
  parentIsSeed: boolean;
  names: string[]; // published names on the page (JSON-LD name, og:title, adapter display name)
  phones: string[];
  emails: string[];
  outboundUrls: string[];
  isGenericPlatformContent: boolean;
  onTrustedOfficialDomain: boolean;
};

export function matchPageToSeed(page: PageFacts, seed: SeedEntity | null): EntityMatch {
  const reasons: string[] = [];
  if (page.isSeed) return { status: "MATCHED", reasons: ["This is the seed URL."] };
  if (page.isGenericPlatformContent) return { status: "REJECTED", reasons: ["Platform login wall / generic shell -- describes the platform, not the entity."] };
  if (isPlatformBoilerplateUrl(page.url)) return { status: "REJECTED", reasons: ["Platform infrastructure or navigation page (not a profile, page or channel)."] };
  if (page.onTrustedOfficialDomain) return { status: "MATCHED", reasons: ["Page on the verified official website."] };

  if (!seed) return { status: "UNVERIFIED", reasons: ["Seed entity could not be resolved; nothing to match against."] };

  // A page on the seed's own domain IS the seed (website seeds: /contact,
  // /about when the homepage itself 403s; social seeds never reach here
  // because platform hosts are handled above as profile-shaped or boilerplate).
  const seedDomain = (canonicalDomain(seed.url) || "").toLowerCase();
  const pageDomainEarly = (canonicalDomain(page.url) || "").toLowerCase();
  if (seed.platform === "website" && seedDomain && pageDomainEarly === seedDomain) return { status: "MATCHED", reasons: ["Same domain as the seed website."] };

  const linksBack = page.outboundUrls.some((u) => urlNamesSeed(u, seed));
  if (linksBack) reasons.push(`Links to the exact seed account${seed.platformId ? ` (${seed.platform} id ${seed.platformId})` : ""}.`);

  const seedName = seed.displayName ? normalizeName(seed.displayName) : "";
  const nameMatch = seedName.length >= 3 && page.names.some((n) => { const nn = normalizeName(n); return nn.length >= 3 && (nn === seedName || nn.includes(seedName) || seedName.includes(nn)); });
  if (nameMatch) reasons.push(`Published name matches the seed display name "${seed.displayName}".`);

  const seedPhones = new Set(seed.phones.map(digitsOf).filter((d) => d.length >= 10));
  const seedEmails = new Set(seed.emails.map((e) => e.toLowerCase()));
  const phoneMatch = page.phones.some((p) => seedPhones.has(digitsOf(p)));
  const emailMatch = page.emails.some((e) => seedEmails.has(e.toLowerCase()));
  if (phoneMatch) reasons.push("Shares a phone number published on the seed page.");
  if (emailMatch) reasons.push("Shares an email published on the seed page.");

  const pageDomain = (canonicalDomain(page.url) || "").toLowerCase();
  const seedLinksHere = !!pageDomain && seed.domains.includes(pageDomain);
  if (seedLinksHere) reasons.push("The seed page itself links to this site.");

  // A page that publishes a clearly DIFFERENT organization identity, with no
  // tie to the seed, is a different entity -- reject rather than leave open.
  const publishesOtherOrg = page.names.length > 0 && seedName.length >= 3 && !nameMatch && !linksBack && !phoneMatch && !emailMatch && !seedLinksHere;

  if (linksBack || (nameMatch && (phoneMatch || emailMatch || seedLinksHere))) return { status: "MATCHED", reasons };
  if (nameMatch || phoneMatch || emailMatch) return { status: "PROBABLE_MATCH", reasons };
  if (seedLinksHere) {
    // The account's own published link: strong for Facebook/Instagram seeds,
    // still only probable because link-in-bio pages can be a friend's site.
    return { status: "PROBABLE_MATCH", reasons };
  }
  if (page.parentIsSeed && !page.parentIsChrome && (page.discoveryMethod === "link_extraction" || page.discoveryMethod === "bio_link" || page.discoveryMethod === "social_link")) {
    return publishesOtherOrg
      ? { status: "REJECTED", reasons: [`Linked from the seed page but publishes a different identity ("${page.names[0]}") with no tie to "${seed.displayName}".`] }
      : { status: "POSSIBLE_MATCH", reasons: ["Linked from the seed page; identity on this page not yet corroborated."] };
  }
  if (page.discoveryMethod === "bio_link" && (page.parentStatus === "MATCHED" || page.parentStatus === "PROBABLE_MATCH")) return { status: "PROBABLE_MATCH", reasons: ["Published link of a matched account."] };
  if ((page.parentStatus === "MATCHED" || page.parentStatus === "PROBABLE_MATCH") && !page.parentIsChrome && (page.discoveryMethod === "link_extraction" || page.discoveryMethod === "website_crawl" || page.discoveryMethod === "social_link")) {
    return publishesOtherOrg
      ? { status: "REJECTED", reasons: [`Linked from a matched page but publishes a different identity ("${page.names[0]}").`] }
      : { status: "POSSIBLE_MATCH", reasons: ["Linked from a matched page; not independently tied to the seed."] };
  }
  if (publishesOtherOrg) return { status: "REJECTED", reasons: [`Publishes a different identity ("${page.names[0]}") and has no link, phone, email or name tie to "${seed.displayName}".`] };
  return { status: "UNVERIFIED", reasons: [`Reached via ${page.discoveryMethod ?? "crawl"} with no evidence tying it to "${seed.displayName ?? seed.url}".`] };
}

export const CONTRIBUTING_STATUSES: ReadonlySet<EntityMatchStatus> = new Set(["MATCHED", "PROBABLE_MATCH"]);
export const EXPANDABLE_STATUSES: ReadonlySet<EntityMatchStatus> = new Set(["MATCHED", "PROBABLE_MATCH", "POSSIBLE_MATCH"]);
