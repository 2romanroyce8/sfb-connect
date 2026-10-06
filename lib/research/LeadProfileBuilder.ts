// ============================================================
// SFB Sales OS — Deep Business Research Engine V4
//
// One submitted URL triggers ONE research job. That job is a real Discovery
// Graph traversal (not a fixed 3-tier "seed -> crawl website -> check 2 bio
// pages" pipeline): every fetched page gets a PRIMARY extraction pass and an
// independent VERIFICATION pass, and anything either pass discovers (a
// website, a social profile, a bio-link hub) is enqueued into the SAME job
// automatically. A Linktree found via Facebook that reveals the real
// website used to have that website discovery silently thrown away because
// only the ORIGINAL seed pages were scanned for "what's the official site" —
// that's fixed here: the website check re-runs against every page as it's
// discovered, however many hops deep.
//
// "Complete" is no longer "the seed page finished." After the graph is
// exhausted, 8 QA passes run against the assembled profile. Pass 3
// (External Link QA) and pass 7 (Gap Analysis QA) are allowed to find real
// new sources and reopen the discovery queue — bounded to a couple of
// cycles so this can't loop forever — before the job is allowed to finish.
// ============================================================
import type { SeedEntity, PageMeta, BusinessGraph, Candidate, FetchedPage, SourceCheck, SourceLogEntry, QAPassResult, ResearchInstrumentation, FetchOutcome } from "./types";
import { fetchPage, classifySeedUrlType, classifySourceType } from "./fetchSource";
import { discoverLinks } from "./LinkDiscoveryService";
import { discoverContacts } from "./ContactDiscoveryService";
import { discoverLocations } from "./LocationDiscoveryService";
import { discoverSocialProfiles } from "./SocialDiscoveryService";
import { resolveField, type Resolved } from "./EvidenceValidator";
import { extractTitle, extractMeta, extractJsonLd, findLocalBusiness, decodeEntities, extractLinks } from "./htmlExtract";
import { classifyLink, canonicalDomain, domainKey, pageKey } from "./normalize";
import { classifyCategoryHeuristic } from "./CategoryClassifier";
import { discoverOfficialWebsite, type WebsiteDiscoveryOutcome } from "./discovery/websiteDiscovery";
import { isRejectedPath, sortByPriority, MAX_PAGES_PER_DOMAIN } from "./CrawlPriority";
import { isGenericPlatformContent } from "./GenericPlatformContent";
import { adapterForUrl, adapterForPlatform, type ProfileExtract } from "./sources/adapters";
import { matchPageToSeed, urlNamesSeed, facebookIdFromUrl, isPlatformBoilerplateUrl, normalizeName, CONTRIBUTING_STATUSES, EXPANDABLE_STATUSES, PLATFORM_CHROME_SOURCES, type EntityMatch } from "./entityMatch";
import { isSocialProfilePath } from "./normalize";
import { extractPhoneNumbers, extractVisibleEmails, extractMailtoEmails } from "./htmlExtract";
import { recoverFromPublicIndex, type PublicIndexOutcome } from "./sources/publicIndex";
import type { ResearchStage } from "./jobProgress";
import {
  runIdentityQA,
  runContactQA,
  runExternalLinkQA,
  runWebsiteQA,
  runSocialPresenceQA,
  runLocationServiceQA,
  runGapAnalysisQA,
  runFinalProfileQA,
  type QAContext,
  type QueuedSource,
} from "./ResearchQA";

export type ResearchStageUpdate = (stage: ResearchStage, meta?: { sourcesFound?: number }) => Promise<void> | void;

// Real scope differences, not cosmetic labels:
//  - "website_only" / "quick_contact" skip bio-link and social-link
//    expansion -- the whole point of restricting to what was submitted
//    rather than fanning out to discover more sources.
//  - "quick_contact" additionally skips location/social discovery entirely,
//    returning only identity + contact channels, faster and narrower.
//  - "public_web", "social_profile", "google_business" all run the full
//    Discovery Graph; the seed URL variety doesn't change discovery
//    breadth, just what kind of page the graph starts from.
export type ResearchScope = "public_web" | "website_only" | "social_profile" | "google_business" | "quick_contact";

const PRIORITY_SLUGS = ["about", "contact", "services", "products", "locations", "service-area", "areas-we-serve", "faq", "booking", "team", "pricing"];
const MAX_TOTAL_SOURCES = 22; // safety bound -- "public_only", "bounded crawl depth/source count" requirement
const MAX_DEPTH = 4;
const MAX_QA_REOPEN_CYCLES = 2; // QA can reopen research, but not forever

type QueueItem = { url: string; discoveredFrom: string | null; discoveryMethod: SourceLogEntry["discoveryMethod"]; depth: number };

// Crawl-frontier identity: two different pages on the same domain must
// produce two different keys, or the graph silently stops crawling a site
// after its first page. This is deliberately NOT canonicalDomain() — see
// pageKey()'s own doc comment in normalize.ts for why that was the bug.
// Crawl-frontier identity: two different pages on the same domain must
// produce two different keys, or the graph silently stops crawling a site
// after its first page. This is deliberately NOT canonicalDomain() — see
// pageKey()'s own doc comment in normalize.ts for why that was the bug.
function urlKey(url: string): string {
  return pageKey(url);
}

const HANDLE_HOSTS = ["facebook.com", "instagram.com", "tiktok.com", "x.com", "twitter.com"];
// Segments that are never themselves a handle -- but several of them
// (pages/people/profile.php) are followed by a real human-readable
// business-name slug that IS usable identity, so this only rules out
// treating the segment itself as the handle, not the whole URL.
const NON_HANDLE_SEGMENTS = new Set(["profile.php", "pages", "people", "share"]);

/** Pulls a username/handle straight out of a seed social URL -- this is
 * real identity evidence even when the page itself can't be fetched (e.g.
 * a blocked Facebook profile), and it's the strongest signal the query
 * generator can use.
 *
 * Handles three real Facebook URL shapes, not just the vanity-username
 * one:
 *   facebook.com/tonytints925                       -> "tonytints925"
 *   facebook.com/pages/Some-Business-Name/123456789  -> "Some Business Name"
 *   facebook.com/people/Some-Business-Name/pfbid...  -> "Some Business Name"
 * A bare facebook.com/profile.php?id=NNNN (no name segment at all) still
 * has no recoverable text identity -- that's an honest dead end, not a bug,
 * since a raw numeric ID isn't a usable search query. */
export function extractHandleFromSeeds(seedSources: string[]): string | null {
  for (const s of seedSources) {
    try {
      const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
      const host = u.hostname.replace(/^www\.|^m\./, "");
      if (!HANDLE_HOSTS.includes(host)) continue;
      const segments = u.pathname.split("/").filter(Boolean);
      const first = segments[0];
      if (first && !NON_HANDLE_SEGMENTS.has(first)) return first;
      // pages/<name>/<id> and people/<name>/<id> -- the second segment is a
      // real, human-readable business-name slug worth turning into a query.
      if ((first === "pages" || first === "people") && segments[1]) {
        const nameSlug = segments[1].replace(/[-_]+/g, " ").trim();
        if (nameSlug) return nameSlug;
      }
    } catch {
      // not a URL — nothing to extract
    }
  }
  return null;
}

/** Same-domain links matching a business-information page type — the
 * queue-native replacement for the old fixed "crawl exactly 6 pages"
 * helper. Runs against ANY page that turns out to be the official website,
 * however many hops from the seed it was discovered. Returned highest-value
 * first (contact/about/services before gallery/blog) so that when a site
 * has more matching pages than the per-domain budget allows, enqueue()
 * spends that budget on the pages a salesperson actually cares about. */
function discoverWebsiteSubPages(page: FetchedPage): string[] {
  const domain = canonicalDomain(page.finalUrl);
  const links = extractLinks(page.html, page.finalUrl);
  const matches = links.filter((l) => {
    if (canonicalDomain(l) !== domain) return false;
    try {
      return PRIORITY_SLUGS.some((slug) => new URL(l).pathname.toLowerCase().includes(slug));
    } catch {
      return false;
    }
  });
  return sortByPriority(Array.from(new Set(matches)));
}

// A handful of common paths worth guessing on a domain we already believe
// (from other evidence -- a linked-to website, a search-discovered
// candidate) IS the official site, even though its own root fetch failed.
// Bounded to two guesses so a wrong guess costs almost nothing against the
// per-domain budget. This is what lets a real /contact page still get
// found and used when the homepage itself 403s/times out, instead of the
// whole site being written off.
const HOMEPAGE_FAILURE_GUESS_PATHS = ["/contact", "/about"];

export async function buildLeadProfile(
  seedSources: string[],
  onStage?: ResearchStageUpdate,
  scope: ResearchScope = "public_web"
): Promise<{ graph: BusinessGraph; allPages: FetchedPage[]; instrumentation: ResearchInstrumentation }> {
  const skipExpansion = scope === "website_only" || scope === "quick_contact";
  const skipLocationsAndSocials = scope === "quick_contact";

  const visited = new Map<string, FetchedPage>();
  const profileExtracts = new Map<string, ProfileExtract>();
  // SEED ENTITY LOCK -- resolved from the seed page(s) before any expansion,
  // then immutable for the rest of the job. Every discovered page is matched
  // against it (pageMatch) before it may expand or contribute fields.
  let seedEntity: SeedEntity | null = null;
  const pageMatch = new Map<string, EntityMatch>();
  const itemMeta = new Map<string, { discoveryMethod: SourceLogEntry["discoveryMethod"]; discoveredFrom: string | null }>();
  const sourceLog: SourceLogEntry[] = [];
  const queuedKeys = new Set<string>();
  const queue: QueueItem[] = [];
  let officialWebsite: string | null = null;
  let websiteSubPagesQueued = false;
  // Captured separately from `visited` (which is now keyed per-page, not
  // per-domain) so seed-fetch instrumentation always reflects the actual
  // seed page's own fetch attempts even if other pages on the same domain
  // are fetched later.
  const seedPageByUrl = new Map<string, FetchedPage>();
  // Per-domain page count -- fixing pageKey() lets a real multi-page site
  // get crawled at all, which means it also needs a ceiling so ONE site
  // can't consume the entire MAX_TOTAL_SOURCES graph budget by itself
  // (e.g. a paginated blog or one page per city/team-member).
  const domainPageCount = new Map<string, number>();
  // Guards the homepage-failure common-path guess (below) to at most once
  // per domain, regardless of how many times a node on that domain fails.
  const homepageGuessedDomains = new Set<string>();

  function enqueue(url: string, discoveredFrom: string | null, discoveryMethod: SourceLogEntry["discoveryMethod"], depth: number) {
    if (depth > MAX_DEPTH) return;
    if (isRejectedPath(url)) return; // admin/auth/commerce/legal/tracking-archive noise -- never worth a fetch
    // Platform infrastructure / navigation (youtube.com/howyoutubeworks,
    // /creators, manifests, feeds, CDN assets, lookup/spam sites) is never a
    // business source -- not fetched, not counted. Seeds are always allowed.
    if (discoveryMethod !== "seed" && isPlatformBoilerplateUrl(url)) return;
    if (!itemMeta.has(urlKey(url))) itemMeta.set(urlKey(url), { discoveryMethod, discoveredFrom });
    const key = urlKey(url);
    if (queuedKeys.has(key) || visited.has(key)) return;
    const domain = domainKey(url) || url.toLowerCase();
    const domainCount = domainPageCount.get(domain) ?? 0;
    if (domainCount >= MAX_PAGES_PER_DOMAIN) return; // this domain has already used its crawl budget
    queuedKeys.add(key);
    domainPageCount.set(domain, domainCount + 1);
    queue.push({ url, discoveredFrom, discoveryMethod, depth });
  }

  for (const s of seedSources) enqueue(s, null, "seed", 0);

  // One shared node-processing routine used for BOTH the initial traversal
  // and any QA-triggered reopening, so verification passes and website
  // sub-page discovery behave identically no matter when a source enters
  // the graph.
  async function processNode(item: QueueItem) {
    const key = urlKey(item.url);
    if (visited.has(key)) return;

    await onStage?.("DISCOVERING_SOURCES", { sourcesFound: visited.size });
    const page = await fetchPage(item.url);
    visited.set(key, page);
    if (item.discoveryMethod === "seed") seedPageByUrl.set(item.url, page);
    const logEntry: SourceLogEntry = {
      url: item.url,
      sourceType: page.sourceType,
      discoveredFrom: item.discoveredFrom,
      discoveryMethod: item.discoveryMethod,
      fetchStatus: page.ok ? "ok" : "unavailable",
      blockedReason: page.ok ? undefined : page.blockedReason,
      primaryPassDone: false,
      verificationPassDone: false,
    };
    sourceLog.push(logEntry);
    if (!page.ok) {
      // The failed page's own root (homepage) being unreachable must not
      // silently end research for the whole domain -- if we can still
      // find real evidence on a well-known sub-path (e.g. /contact
      // happens to be up even though / 403s), that evidence is genuine
      // and should be used. Bounded to root-looking URLs and 2 guesses,
      // once per domain.
      let isRootPath = false;
      try {
        const p = new URL(page.finalUrl || item.url).pathname;
        isRootPath = p === "/" || p === "";
      } catch {
        isRootPath = false;
      }
      const domain = domainKey(item.url) || item.url.toLowerCase();
      if (isRootPath && !homepageGuessedDomains.has(domain)) {
        homepageGuessedDomains.add(domain);
        for (const guessPath of HOMEPAGE_FAILURE_GUESS_PATHS) {
          try {
            const guessUrl = new URL(guessPath, item.url).toString();
            enqueue(guessUrl, item.url, "website_crawl", item.depth + 1);
          } catch {
            // unparseable base -- skip this guess
          }
        }
      }
      return;
    }

    // A platform's own generic shell content (bare homepage, login wall)
    // must not seed further discovery -- its outbound links are platform
    // navigation chrome (e.g. Instagram's footer linking to meta.ai), not
    // evidence about the business. This is what stops a blocked profile
    // from being silently replaced by the PLATFORM's own identity. The
    // page still counts as visited (sourceLog/sourceChecks unaffected) --
    // it just contributes nothing.
    const genericContent = isGenericPlatformContent(page);
    logEntry.genericPlatformContent = genericContent || undefined;

    // ENTITY MATCH against the locked seed (null while the seed itself is
    // being processed). Decides whether this page may expand or contribute.
    const match = evaluatePageMatch(page, item);
    pageMatch.set(urlKey(page.finalUrl), match);
    pageMatch.set(urlKey(item.url), match);
    const mayContribute = item.discoveryMethod === "seed" || CONTRIBUTING_STATUSES.has(match.status);
    const mayExpand = item.discoveryMethod === "seed" || EXPANDABLE_STATUSES.has(match.status);

    // SOURCE ADAPTER: what does this platform's own rendered page publish?
    // (TikTok hydration JSON, LinkedIn company About, X og tags.) Stored per
    // page; aggregate() prefers it over generic <title>/og:title text, and
    // the adapter-published website/links enter the graph like any link.
    if (!genericContent) {
      const adapter = adapterForPlatform(page.sourceType);
      const extract = adapter?.extractProfile(page) ?? null;
      if (extract) {
        profileExtracts.set(urlKey(page.finalUrl), extract);
        profileExtracts.set(urlKey(item.url), extract);
        if (!officialWebsite && extract.website && item.discoveryMethod === "seed") officialWebsite = extract.website;
        if (!skipExpansion) for (const l of extract.links) enqueue(l, item.url, "bio_link", item.depth + 1);
      }
    }

    // PRIMARY EXTRACTION
    const primary = genericContent ? { officialWebsite: null, linkInBioPages: [], socials: [], bookingLinks: [] } : discoverLinks(page);
    logEntry.primaryPassDone = true;
    // A LinkedIn / X / TikTok / YouTube page's generic outbound links are the
    // PLATFORM's (sidebar "people also viewed", ads, CDN, footer), not the
    // account's. Observed live: a LinkedIn profile's sidebar handed the
    // engine an unrelated company (Kalicube) as THE business, and X's CDN
    // became the official website. Only the account-published link (from
    // the adapter) may set the official website for these platforms.
    const platformChrome = PLATFORM_CHROME_SOURCES.has(page.sourceType);
    // OFFICIAL WEBSITE GATE: discovery != verification. A page may nominate
    // the official website only if it is the seed, or it has itself been
    // matched to the seed (MATCHED / PROBABLE). A search hit that merely
    // declares itself a "website" (LinkDiscoveryService self-declaration)
    // is a candidate, not the answer -- this is exactly how phone.gd became
    // an HVAC company's website.
    if (!officialWebsite && primary.officialWebsite && !platformChrome && mayContribute) officialWebsite = primary.officialWebsite;
    // From platform chrome, a "social link" to the SAME platform is the
    // platform's own navigation (LinkedIn -> /pulse articles, /company/<ad>,
    // /games). Observed live: 14 such pages burned the crawl budget before the
    // discovered official website could be fetched.
    const samePlatform = (u: string) => platformChrome && classifySourceType(u) === page.sourceType;
    const profileShaped = (u: string) => { const c = classifyLink(u); return c.kind !== "social" || isSocialProfilePath(u, (c as { platform: string }).platform); };
    // UNVERIFIED / REJECTED pages are dead ends: finding them is not a reason
    // to follow them. Only matched pages (and the seed) expand the graph.
    if (!skipExpansion && !genericContent && mayExpand) {
      for (const bioUrl of primary.linkInBioPages) enqueue(bioUrl, item.url, "bio_link", item.depth + 1);
      for (const s of primary.socials) if (!samePlatform(s.url) && profileShaped(s.url)) enqueue(s.url, item.url, "social_link", item.depth + 1);
    }

    // VERIFICATION EXTRACTION — independently re-scans every raw href on
    // the SAME page (not filtered by primary's self-domain/kind branching)
    // so a bio-link or social host primary's ordering happened to skip
    // still gets caught before this source is marked done.
    await onStage?.("VERIFYING_SOURCES", { sourcesFound: visited.size });
    if (!skipExpansion && !genericContent && mayExpand) {
      for (const link of extractLinks(page.html, page.finalUrl)) {
        const cls = classifyLink(link);
        if (cls.kind === "linktree") enqueue(link, item.url, "bio_link", item.depth + 1);
        if (cls.kind === "social" && !samePlatform(link) && profileShaped(link)) enqueue(link, item.url, "social_link", item.depth + 1);
      }
    }
    logEntry.verificationPassDone = true;

    // A website discovered via ANY page (not just the seed) must actually
    // enter the queue — this is the concrete fix for "Linktree revealed the
    // website but it was never crawled."
    if (officialWebsite && !visited.has(urlKey(officialWebsite)) && !queuedKeys.has(urlKey(officialWebsite))) {
      enqueue(officialWebsite, item.url, "link_extraction", item.depth + 1);
    }

    // This page IS the official website -> queue its business-information
    // sub-pages (contact/about/services/etc), once.
    if (officialWebsite && urlKey(page.finalUrl) === urlKey(officialWebsite) && !websiteSubPagesQueued && mayExpand) {
      await onStage?.("READING_WEBSITE", { sourcesFound: visited.size });
      for (const sub of discoverWebsiteSubPages(page)) enqueue(sub, page.finalUrl, "website_crawl", item.depth + 1);
      websiteSubPagesQueued = true;
    }
  }

  async function drainQueue() {
    while (queue.length > 0 && visited.size < MAX_TOTAL_SOURCES) {
      const item = queue.shift()!;
      await processNode(item);
    }
  }

  /** Published names / contacts / outbound links of a fetched page, as the
   * entity matcher needs them. */
  function pageFacts(page: FetchedPage, item: QueueItem) {
    const extract = profileExtracts.get(urlKey(page.finalUrl)) ?? profileExtracts.get(urlKey(item.url)) ?? null;
    const names: string[] = [];
    if (extract?.displayName) names.push(extract.displayName);
    const ld = findLocalBusiness(extractJsonLd(page.html)); if (ld?.name) names.push(decodeEntities(String(ld.name)));
    const og = extractMeta(page.html, "og:title"); if (og) names.push(decodeEntities(og.split(/[|–—-]/)[0]).trim());
    const parentKey = item.discoveredFrom ? urlKey(item.discoveredFrom) : null;
    const parent = parentKey ? visited.get(parentKey) : undefined;
    const isSeedUrl = (u: string) => seedSources.some((sUrl) => urlKey(sUrl) === urlKey(u)) || (seedEntity ? urlNamesSeed(u, seedEntity) : false);
    return {
      url: page.finalUrl,
      sourceType: page.sourceType,
      isSeed: item.discoveryMethod === "seed" || isSeedUrl(page.finalUrl),
      discoveryMethod: item.discoveryMethod,
      parentStatus: parentKey ? pageMatch.get(parentKey)?.status ?? null : null,
      parentIsChrome: parent ? PLATFORM_CHROME_SOURCES.has(parent.sourceType) : false,
      parentIsSeed: !!item.discoveredFrom && isSeedUrl(item.discoveredFrom),
      names: names.filter(Boolean),
      phones: extractPhoneNumbers(page.html),
      emails: [...extractMailtoEmails(page.html), ...extractVisibleEmails(page.html)],
      outboundUrls: extractLinks(page.html, page.finalUrl),
      isGenericPlatformContent: isGenericPlatformContent(page),
      onTrustedOfficialDomain: !!officialWebsite && domainKey(page.finalUrl) === domainKey(officialWebsite) && (pageMatch.get(urlKey(officialWebsite))?.status === "MATCHED" || pageMatch.get(urlKey(officialWebsite))?.status === "PROBABLE_MATCH" || seedSources.some((sUrl) => urlKey(sUrl) === urlKey(officialWebsite!))),
    };
  }
  function evaluatePageMatch(page: FetchedPage, item: QueueItem): EntityMatch {
    if (item.discoveryMethod === "seed") return { status: "MATCHED", reasons: ["This is the seed URL."] };
    return matchPageToSeed(pageFacts(page, item), seedEntity);
  }

  /** SEED RESOLUTION: what exact entity does the user's URL represent? Built
   * from the seed page(s) only -- adapter extract, og tags, contacts and
   * outbound links on that page. Nothing discovered later can change it. */
  function resolveSeedEntity(): SeedEntity {
    const seedUrl = seedSources[0];
    const page = seedPageByUrl.get(seedUrl) ?? Array.from(seedPageByUrl.values())[0] ?? null;
    const platform = classifySourceType(seedUrl);
    const adapter = adapterForUrl(seedUrl);
    const extract = page ? (profileExtracts.get(urlKey(page.finalUrl)) ?? profileExtracts.get(urlKey(seedUrl)) ?? null) : null;
    const canonicalUrl = page?.finalUrl ?? seedUrl;
    const platformId = platform === "facebook" ? (facebookIdFromUrl(seedUrl) ?? facebookIdFromUrl(canonicalUrl)) : null;
    const username = adapter ? adapter.handleFromUrl(seedUrl) : null;
    let displayName: string | null = extract?.displayName ?? null;
    let resolvedFrom: SeedEntity["resolvedFrom"] = "none";
    if (page?.ok && !isGenericPlatformContent(page)) {
      if (!displayName) {
        const og = extractMeta(page.html, "og:title") ?? extractTitle(page.html);
        if (og) displayName = decodeEntities(og).replace(/\s*[|–—-]\s*(facebook|instagram|tiktok|linkedin|x)\s*$/i, "").replace(/\s*\|\s*.*$/, "").trim() || null;
      }
      if (displayName) resolvedFrom = "page";
    }
    if (!displayName) {
      // URL text identity (facebook.com/people/Supreme-Air-LLC/<id>) -- weak but real.
      const slug = extractHandleFromSeeds([seedUrl]);
      if (slug && !/^\d+$/.test(slug) && !/^profile\.php/.test(slug)) { displayName = slug.replace(/[-_.]+/g, " ").trim(); resolvedFrom = "url"; }
    }
    const phones = page?.ok ? extractPhoneNumbers(page.html) : [];
    const emails = page?.ok ? [...extractMailtoEmails(page.html), ...extractVisibleEmails(page.html)] : [];
    const links = page?.ok && !isGenericPlatformContent(page) ? discoverLinks(page) : null;
    const domains = new Set<string>();
    if (links?.officialWebsite && !isPlatformBoilerplateUrl(links.officialWebsite)) { const d = canonicalDomain(links.officialWebsite); if (d) domains.add(d.toLowerCase()); }
    if (extract?.website) { const d = canonicalDomain(extract.website); if (d) domains.add(d.toLowerCase()); }
    const personLike = !!displayName && /^[A-Z][a-z'’.-]+(?: [A-Z][a-z'’.-]+){1,3}$/.test(displayName) && !/\b(llc|inc|co|services?|removal|hauling|roofing|hvac|plumbing|cleaning|landscap|repair|construction|auto|salon|studio|shop|store|cafe|restaurant|bar|grill|dental|law|realty|photography|air|group|solutions)\b/i.test(displayName);
    const entityHint: SeedEntity["entityHint"] = extract?.flags.business || extract?.flags.organization || extract?.urlKind === "company" ? "business" : extract?.urlKind === "person" ? "person" : personLike ? "person" : displayName ? "business" : "unknown";
    return { url: seedUrl, canonicalUrl, platform, platformId, username, displayName, entityHint, phones, emails, domains: Array.from(domains), resolved: !!displayName, resolvedFrom };
  }

  // SEED FIRST: fetch and process the seed URL(s) alone, resolve + lock the
  // seed entity, and only then let discovery run against it.
  await onStage?.("DISCOVERING_SOURCES", { sourcesFound: 0 });
  const seedItems = queue.splice(0, queue.length).filter((q) => q.discoveryMethod === "seed");
  const deferred = queue.splice(0, queue.length);
  for (const seedItem of seedItems) await processNode(seedItem);
  seedEntity = resolveSeedEntity();
  // Children enqueued while processing the seed were matched with
  // seedEntity === null; re-evaluate them lazily as they are processed (the
  // match is computed at fetch time, after the lock, so nothing to redo).
  queue.push(...deferred);
  await drainQueue();
  let allPages = Array.from(visited.values());

  // Buffers filled by the Instagram public-index recovery below; empty for
  // every other seed. aggregate() folds them in alongside fetched pages.
  const indexPageMeta: PageMeta[] = [];
  const indexContacts: { phone: Candidate[]; email: Candidate[] } = { phone: [], email: [] };
  const indexNameCandidates: Candidate[] = [];
  let socialRecovery: BusinessGraph["socialRecovery"] | undefined;

  // ---- AGGREGATE EXTRACTION over the full discovery-graph result ----
  async function aggregate() {
    // Platform-generic shell content (bare homepage, login wall) is
    // excluded from every identity-contributing extraction below -- it's
    // visited/logged, but a page that describes the PLATFORM rather than
    // the business must never seed a name, category, contact, location, or
    // social-profile candidate. See GenericPlatformContent.ts.
    const contentPages = allPages.filter((p) => p.ok && !isGenericPlatformContent(p));
    // A page reached via wider-web discovery (gap analysis / independent
    // search) was validated by nothing stronger than a fingerprint guess --
    // never a confirmed link FROM the business's own site or profile. Its
    // identity candidates are capped at the weakest strength tier so a
    // wider-web hit can never outrank (or alone produce "verified" status
    // for) evidence found by direct crawling, and so a genuine name/entity
    // collision (two different real "Arturo Herrera"s, for example) can't
    // silently overwrite an already-established identity.
    const discoveryMethodByKey = new Map(sourceLog.map((s) => [urlKey(s.url), s.discoveryMethod] as const));
    const isWiderWebDiscovered = (page: FetchedPage) => {
      const m = discoveryMethodByKey.get(urlKey(page.finalUrl));
      return m === "gap_analysis" || m === "search_discovery";
    };

    // ---- ENTITY MATCHING: which reached pages are actually tied to the
    // seed entity? Only those may contribute contacts, locations, socials,
    // category and services. Observed live: a LinkedIn profile's sidebar
    // company (Kalicube) supplied the "business" location and category.
    //   trusted(seed)                              = yes
    //   trusted(page on the official website)      = yes (officialWebsite is
    //                                                 itself only ever set from
    //                                                 non-chrome pages / the
    //                                                 account's published link)
    //   trusted(page linking back to the seed)     = yes
    //   trusted(found via index/gap/QA search)     = only by the two rules above
    //   trusted(linked from a trusted page)        = yes, unless the parent is
    //                                                 platform chrome (LinkedIn /
    //                                                 X / TikTok / YouTube) and
    //                                                 not the seed itself
    const normSeedUrl = (u: string) => u.toLowerCase().replace(/^https?:\/\/(www\.|m\.|mbasic\.)?/, "").replace(/\/+$/, "").replace(/\?.*$/, "");
    const seedKeySet = new Set(seedSources.map(normSeedUrl));
    const seedTypes = new Set(seedSources.map((u) => classifySourceType(u)));
    const CHROME = new Set(["linkedin", "x", "tiktok", "youtube"]);
    const logByKey = new Map(sourceLog.map((e) => [urlKey(e.url), e] as const));
    const officialDomainNow = officialWebsite ? domainKey(officialWebsite) : null;
    const linksBackCache = new Map<string, boolean>();
    const pageLinksBack = (page: FetchedPage) => {
      const k = urlKey(page.finalUrl);
      if (!linksBackCache.has(k)) linksBackCache.set(k, !seedTypes.has(page.sourceType) && extractLinks(page.html, page.finalUrl).some((l) => seedKeySet.has(normSeedUrl(l))));
      return linksBackCache.get(k)!;
    };
    // What the seed account itself says it is (adapter-published display name
    // for business/organization accounts, LinkedIn headline). A reached page
    // whose own published name matches is entity-matched by the account's
    // own words -- e.g. 1800gotjunk.com for a profile headlined
    // "1-800-GOT-JUNK?".
    const normName = (v: string) => v.toLowerCase().replace(/&amp;/g, "&").replace(/\b(llc|inc|co|corp|corporation|company|ltd|the)\b\.?/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
    const seedSelfNames = new Set<string>();
    for (const sUrl of seedSources) {
      const ex = profileExtracts.get(urlKey(sUrl));
      if (!ex) continue;
      if (ex.headline) for (const part of ex.headline.split(/\s*[|·•]\s*/)) { const n = normName(part); if (n.length >= 4) seedSelfNames.add(n); }
      if (ex.displayName && (ex.flags.business || ex.flags.organization || ex.urlKind === "company")) { const n = normName(ex.displayName); if (n.length >= 4) seedSelfNames.add(n); }
    }
    const selfNameMatch = (page: FetchedPage): boolean => {
      if (seedSelfNames.size === 0) return false;
      const pageExtract = profileExtracts.get(urlKey(page.finalUrl)) ?? profileExtracts.get(urlKey(page.url)) ?? null;
      // Platform chrome never matches -- except a platform COMPANY page the
      // adapter recognises as a business/organization (e.g. the LinkedIn
      // company page the person's Experience section links to).
      if (CHROME.has(page.sourceType) && !(pageExtract && (pageExtract.flags.business || pageExtract.flags.organization))) return false;
      const names: string[] = [];
      if (pageExtract?.displayName) names.push(pageExtract.displayName);
      const ld = findLocalBusiness(extractJsonLd(page.html)); if (ld?.name) names.push(String(ld.name));
      const og = extractMeta(page.html, "og:title"); if (og) names.push(decodeEntities(og.split(/[|–—-]/)[0]));
      return names.some((nm) => { const n = normName(nm); return n.length >= 4 && Array.from(seedSelfNames).some((sn) => n === sn || n.includes(sn) || sn.includes(n)); });
    };
    const trustCache = new Map<string, boolean>();
    const isTrusted = (page: FetchedPage, depth = 0): boolean => {
      const k = urlKey(page.finalUrl);
      if (trustCache.has(k)) return trustCache.get(k)!;
      trustCache.set(k, false); // cycle guard
      let t = false;
      const isSeed = seedKeySet.has(normSeedUrl(page.url)) || seedKeySet.has(normSeedUrl(page.finalUrl));
      if (isSeed) t = true;
      else if (officialDomainNow && domainKey(page.finalUrl) === officialDomainNow) t = true;
      else if (pageLinksBack(page)) t = true;
      else if (selfNameMatch(page)) t = true;
      else if (depth < 6) {
        const entry = logByKey.get(urlKey(page.url)) ?? logByKey.get(k);
        const via = entry?.discoveryMethod;
        if (entry?.discoveredFrom && via && !["search_discovery", "gap_analysis", "qa_reopen", "public_index"].includes(via)) {
          const parent = visited.get(urlKey(entry.discoveredFrom));
          if (parent) {
            const parentIsChrome = CHROME.has(parent.sourceType);
            // Through platform chrome (LinkedIn / X / TikTok / YouTube -- seed
            // included: its sidebar is still the platform's), only the
            // account's own published link (bio_link) carries trust.
            if (parentIsChrome) t = via === "bio_link" && isTrusted(parent, depth + 1);
            else t = isTrusted(parent, depth + 1);
          }
        }
      }
      trustCache.set(k, t);
      return t;
    };
    // A page contributes fields only when its entity match says so; the
    // older link-propagation trust is kept as a secondary route for seeds
    // whose entity could not be resolved at all.
    const isContributing = (p: FetchedPage) => { const m = pageMatch.get(urlKey(p.finalUrl)) ?? pageMatch.get(urlKey(p.url)); return m ? CONTRIBUTING_STATUSES.has(m.status) : isTrusted(p); };
    const trustedPages = contentPages.filter((p) => isContributing(p));

    await onStage?.("EXTRACTING_CONTACTS", { sourcesFound: visited.size });
    const bookingLinks: string[] = [];
    for (const page of trustedPages) {
      bookingLinks.push(...discoverLinks(page).bookingLinks);
    }
    const contacts = discoverContacts(trustedPages, Array.from(new Set(bookingLinks)));
    for (const c of indexContacts.phone) contacts.phone.push(c);
    for (const c of indexContacts.email) contacts.email.push(c);

    await onStage?.("EXTRACTING_LOCATIONS", { sourcesFound: visited.size });
    const locations = skipLocationsAndSocials ? [] : discoverLocations(trustedPages);

    await onStage?.("EXTRACTING_SOCIALS", { sourcesFound: visited.size });
    const socialProfiles = skipLocationsAndSocials ? [] : discoverSocialProfiles(trustedPages);

    await onStage?.("CLASSIFYING_BUSINESS", { sourcesFound: visited.size });
    const nameCandidates: Candidate[] = [];
    const categoryCandidates: Candidate[] = [];
    let description: string | null = null;
    let ownerName: string | null = null;
    const services = new Set<string>();
    let hasJsonLd = false;
    let hasMetaDescription = false;
    let hasAggregateRating = false;

    const normSeed = (u: string) => u.toLowerCase().replace(/^https?:\/\/(www\.|m\.|mbasic\.)?/, "").replace(/\/+$/, "").replace(/\?.*$/, "");
    const seedKeys = new Set(seedSources.map(normSeed));
    const pageMeta: PageMeta[] = [...indexPageMeta];
    for (const page of contentPages) {
      // Cross-link verification: does this page link to the exact seed
      // URL/handle? A website whose footer points at instagram.com/<seed
      // handle> (or the seed Facebook page) is tied to the same entity by
      // the entity itself -- the strongest association signal we have.
      // Same-platform pages (x.com/<handle>/photo linking to x.com/<handle>)
      // are the seed talking about itself -- not a cross-link.
      const linksToSeed = pageLinksBack(page);
      const trusted = isContributing(page);
      const entityMatch = pageMatch.get(urlKey(page.finalUrl)) ?? pageMatch.get(urlKey(page.url)) ?? undefined;
      const capStrength = (s: number) => (isWiderWebDiscovered(page) ? Math.min(s, 1) : s);
      const title = extractTitle(page.html);
      const ogTitle = extractMeta(page.html, "og:title");
      const metaDesc = extractMeta(page.html, "description") || extractMeta(page.html, "og:description");
      pageMeta.push({
        url: page.finalUrl,
        requestedUrl: page.url,
        sourceType: page.sourceType,
        isSeed: seedKeys.has(normSeed(page.url)) || seedKeys.has(normSeed(page.finalUrl)),
        linksToSeed: linksToSeed || undefined,
        trusted,
        entityMatch,
        title: title ? decodeEntities(title) : null,
        ogTitle: ogTitle ? decodeEntities(ogTitle) : null,
        description: metaDesc ? decodeEntities(metaDesc) : null,
      });
      if (metaDesc && trusted) {
        hasMetaDescription = true;
        if (!description) description = metaDesc;
      }
      const jsonLd = extractJsonLd(page.html);
      const localBusiness = trusted ? findLocalBusiness(jsonLd) : null;
      if (jsonLd.length > 0 && trusted) hasJsonLd = true;
      if (trusted && jsonLd.some((b) => !!b["aggregateRating"])) hasAggregateRating = true;

      const extract = profileExtracts.get(urlKey(page.finalUrl)) ?? profileExtracts.get(urlKey(page.url)) ?? null;
      if (extract) {
        // Platform page: the account's published display name is the name
        // evidence; its <title> ("TikTok - Make Your Day") is platform chrome.
        const metaEntry = pageMeta[pageMeta.length - 1];
        metaEntry.ogTitle = extract.displayName ?? metaEntry.ogTitle;
        metaEntry.description = [extract.headline, extract.bio].filter(Boolean).join(" | ") || metaEntry.description;
        metaEntry.accountFlags = extract.flags;
        metaEntry.headline = extract.headline;
        if (extract.companyFacts) metaEntry.companyFacts = extract.companyFacts;
        if (extract.displayName && (metaEntry.isSeed || extract.flags.business || extract.flags.organization)) {
          nameCandidates.push({ value: extract.displayName, sourceUrl: page.finalUrl, sourceType: page.sourceType, strength: capStrength(extract.flags.business || extract.flags.organization ? 3 : 2) });
        }
        if (trusted && extract.category) categoryCandidates.push({ value: extract.category, sourceUrl: page.finalUrl, sourceType: page.sourceType, strength: capStrength(2) });
        if (trusted) for (const sp of extract.companyFacts?.specialties ?? []) services.add(sp);
      } else {
        if (localBusiness?.name) nameCandidates.push({ value: decodeEntities(String(localBusiness.name)), sourceUrl: page.finalUrl, sourceType: page.sourceType, strength: capStrength(3) });
        if (ogTitle) nameCandidates.push({ value: decodeEntities(ogTitle.split(/[|–—-]/)[0]), sourceUrl: page.finalUrl, sourceType: page.sourceType, strength: capStrength(2) });
        if (title) nameCandidates.push({ value: decodeEntities(title.split(/[|–—-]/)[0]), sourceUrl: page.finalUrl, sourceType: page.sourceType, strength: capStrength(1) });
      }

      const schemaType = trusted ? localBusiness?.["@type"] : undefined;
      if (schemaType) categoryCandidates.push({ value: String(Array.isArray(schemaType) ? schemaType[0] : schemaType), sourceUrl: page.finalUrl, sourceType: page.sourceType, strength: capStrength(2) });

      const makesOffer = localBusiness?.makesOffer;
      if (makesOffer) {
        const list = Array.isArray(makesOffer) ? makesOffer : [makesOffer];
        for (const offer of list) {
          const name = (offer as any)?.itemOffered?.name || (offer as any)?.name;
          if (name) services.add(String(name));
        }
      }
      const employee = localBusiness?.employee || localBusiness?.founder;
      if (employee && !ownerName) {
        const emp = Array.isArray(employee) ? employee[0] : employee;
        const name = typeof emp === "string" ? emp : (emp as any)?.name;
        if (name) ownerName = String(name);
      }
    }

    for (const c of indexNameCandidates) nameCandidates.push(c);
    const heuristicCategory = classifyCategoryHeuristic(trustedPages);
    if (heuristicCategory) categoryCandidates.push(heuristicCategory);

    // NAME LOCK: when the seed resolved a business-type display name, that IS
    // the business name. Other pages' names can corroborate it or be shown as
    // possibilities -- they can never replace it. (Person-type seeds leave the
    // person/business split to the entity layer.)
    const lockedName = seedEntity?.resolved && seedEntity.displayName && seedEntity.entityHint === "business" ? seedEntity.displayName : null;
    const name = lockedName
      ? { value: lockedName, status: "verified" as const, confidence: 0.95, sources: [seedEntity!.canonicalUrl] }
      : resolveField(nameCandidates.filter((c) => { const m = pageMatch.get(urlKey(c.sourceUrl)); return !m || CONTRIBUTING_STATUSES.has(m.status) || m.status === "POSSIBLE_MATCH"; }));
    const categoryResolved = resolveField(categoryCandidates);

    await onStage?.("CROSS_VALIDATING", { sourcesFound: visited.size });
    const contactMethods = [
      { type: "phone" as const, ...normalizeResolved(resolveField(contacts.phone)) },
      { type: "email" as const, ...normalizeResolved(resolveField(contacts.email)) },
      { type: "whatsapp" as const, ...normalizeResolved(resolveField(contacts.whatsapp)) },
      {
        type: "website" as const,
        value: officialWebsite,
        status: officialWebsite ? ("verified" as const) : ("not_found" as const),
        confidence: officialWebsite ? 0.9 : 0,
        sourceUrl: officialWebsite,
      },
      { type: "booking" as const, ...normalizeResolved(resolveField(contacts.booking)) },
    ];

    return {
      businessName: name.value ? { value: name.value, sourceUrl: name.sources[0] || "", sourceType: lockedName ? (seedEntity!.platform as string) : ("website" as const), strength: 3 } : null,
      nameCandidates,
      pageMeta,
      category: categoryResolved.value,
      description,
      services: Array.from(services),
      ownerName,
      contactMethods,
      locations,
      socialProfiles,
      signals: { hasJsonLd, hasHttps: !!officialWebsite?.startsWith("https://"), hasMetaDescription, hasAggregateRating },
    };
  }

  let extracted = await aggregate();

  // ---- SOCIAL SEEDS: public-index recovery when the profile page is
  // login-walled to non-browser clients (Instagram always; LinkedIn /in/
  // always; Facebook occasionally). The account's public posts and the
  // pages that link to the exact handle are read from a search index and
  // handed to the SAME discovery graph for fetch + verification. Never a
  // bypass; never attributed to a lookalike account. ----
  const socialSeed = seedSources.map((u) => ({ url: u, adapter: adapterForUrl(u) })).find((x) => x.adapter);
  if (socialSeed?.adapter && scope !== "website_only") {
    const adapter = socialSeed.adapter;
    const seedPage = seedPageByUrl.get(socialSeed.url);
    const seedUsable = !!seedPage?.ok && !isGenericPlatformContent(seedPage);
    if (!seedUsable) {
      await onStage?.("DISCOVERING_SOURCES", { sourcesFound: visited.size });
      const outcome: PublicIndexOutcome = await recoverFromPublicIndex(socialSeed.url, adapter);
      if (outcome.status === "found") {
        socialRecovery = { platform: adapter.platform, status: "found", handle: outcome.handle, displayName: outcome.displayName, postsFound: outcome.posts.length, backlinkCandidates: outcome.websiteCandidates.length + outcome.directoryCandidates.length, provider: outcome.provider, reason: null };
        // The seed account as the index knows it: display name + the text of
        // its own indexed posts/pages standing in for the bio we can't read.
        indexPageMeta.push({ url: socialSeed.url, requestedUrl: socialSeed.url, sourceType: adapter.platform, isSeed: true, title: outcome.displayName, ogTitle: outcome.displayName, description: outcome.captionText.slice(0, 1500) || null });
        if (seedEntity && !seedEntity.resolved && outcome.displayName) seedEntity = { ...seedEntity, displayName: outcome.displayName, resolved: true, resolvedFrom: "index", phones: Array.from(new Set([...seedEntity.phones, ...outcome.phones])), emails: Array.from(new Set([...seedEntity.emails, ...outcome.emails])) };
        if (outcome.displayName) indexNameCandidates.push({ value: outcome.displayName, sourceUrl: socialSeed.url, sourceType: adapter.platform, strength: 2 });
        for (const post of outcome.posts) {
          indexPageMeta.push({ url: post.url, requestedUrl: post.url, sourceType: adapter.platform, isSeed: false, sameAccountAsSeed: true, title: post.title, ogTitle: outcome.displayName, description: post.caption });
          sourceLog.push({ url: post.url, sourceType: adapter.platform, discoveredFrom: socialSeed.url, discoveryMethod: "public_index", fetchStatus: "ok", indexedOnly: true, primaryPassDone: true, verificationPassDone: false });
        }
        const firstPost = outcome.posts[0]?.url ?? socialSeed.url;
        for (const ph of outcome.phones) indexContacts.phone.push({ value: ph, sourceUrl: firstPost, sourceType: adapter.platform, strength: 2 });
        for (const em of outcome.emails) indexContacts.email.push({ value: em, sourceUrl: firstPost, sourceType: adapter.platform, strength: 2 });
        for (const cand of [...outcome.websiteCandidates, ...outcome.mentionedUrls.map((u) => (/^https?:\/\//i.test(u) ? u : `https://${u}`))].slice(0, 4)) enqueue(cand, socialSeed.url, "search_discovery", 1);
        for (const dir of outcome.directoryCandidates) enqueue(dir, socialSeed.url, "search_discovery", 1);
        await drainQueue();
        allPages = Array.from(visited.values());
        extracted = await aggregate();
      } else if (outcome.status === "not_found") {
        socialRecovery = { platform: adapter.platform, status: "not_found", handle: outcome.handle, displayName: null, postsFound: 0, backlinkCandidates: 0, provider: outcome.provider, reason: "No public posts or pages linking to this exact account are in the search index." };
      } else {
        socialRecovery = { platform: adapter.platform, status: "unavailable", handle: outcome.handle || null, displayName: null, postsFound: 0, backlinkCandidates: 0, provider: null, reason: outcome.reason };
      }
    } else {
      socialRecovery = { platform: adapter.platform, status: "not_applicable", handle: adapter.handleFromUrl(socialSeed.url), displayName: null, postsFound: 0, backlinkCandidates: 0, provider: null, reason: "Profile page was readable directly." };
    }
  }

  // ---- RECURSIVE EXPANSION: independent wider-web website discovery ----
  // If nothing the seed linked to (or anything found while crawling it)
  // turned out to be the official website, use the identity actually
  // verified so far to search the wider web for it -- this is the fix for
  // "Facebook gave us a name and phone but no website, and the job just
  // stopped." A found candidate is queued through the SAME Discovery Graph
  // as any other source, so it gets fetched, verified, and its own
  // sub-pages/socials/contacts discovered identically.
  let websiteDiscovery: WebsiteDiscoveryOutcome | undefined;
  if (!officialWebsite && !skipExpansion) {
    await onStage?.("DISCOVERING_SOURCES", { sourcesFound: visited.size });
    const primaryLocation = extracted.locations.find((l) => l.city || l.state);
    // A person-profile seed's engine name is the PERSON; the business to
    // search for is what the headline/bio says ("1-800-GOT-JUNK?").
    const seedExtract = seedSources.map((u) => profileExtracts.get(urlKey(u))).find(Boolean) ?? null;
    const statedBusiness = seedExtract?.headline ? seedExtract.headline.split(/\s*[|·•]\s*/)[0].replace(/^(founder|co-?founder|ceo|owner|president)[^A-Za-z0-9]+(?:of|at|@)?\s*/i, "").trim() || null : null;
    websiteDiscovery = await discoverOfficialWebsite({
      businessName: statedBusiness ?? extracted.businessName?.value ?? null,
      handle: extractHandleFromSeeds(seedSources),
      city: primaryLocation?.city ?? null,
      state: primaryLocation?.state ?? null,
      category: extracted.category,
      phone: extracted.contactMethods.find((c) => c.type === "phone")?.value ?? null,
    });
    if (websiteDiscovery.status === "found") {
      enqueue(websiteDiscovery.url, null, "search_discovery", 0);
      await drainQueue();
      allPages = Array.from(visited.values());
      extracted = await aggregate();
    }
  }

  // ---- 8 QA PASSES — "complete" means these ran, not just that the graph
  // traversal finished. Passes 3 and 7 can discover real new sources and
  // reopen the queue, bounded to MAX_QA_REOPEN_CYCLES. ----
  const qaResults: QAPassResult[] = [];
  for (let cycle = 0; cycle <= MAX_QA_REOPEN_CYCLES; cycle++) {
    const ctx: QAContext = {
      graph: { businessName: extracted.businessName, category: extracted.category, contactMethods: extracted.contactMethods, locations: extracted.locations, socialProfiles: extracted.socialProfiles },
      visitedPages: allPages,
      queuedUrlKeys: queuedKeys,
      officialWebsite,
    };

    await onStage?.("QA_1", { sourcesFound: visited.size });
    const qa1 = runIdentityQA(ctx);
    await onStage?.("QA_2", { sourcesFound: visited.size });
    const qa2 = runContactQA(ctx);
    await onStage?.("QA_3", { sourcesFound: visited.size });
    const { result: qa3, newSources: qa3New } = runExternalLinkQA(ctx);
    await onStage?.("QA_4", { sourcesFound: visited.size });
    const qa4 = runWebsiteQA(ctx);
    await onStage?.("QA_5", { sourcesFound: visited.size });
    const qa5 = runSocialPresenceQA(ctx);
    await onStage?.("QA_6", { sourcesFound: visited.size });
    const qa6 = runLocationServiceQA(ctx);
    await onStage?.("GAP_ANALYSIS", { sourcesFound: visited.size });
    const { result: qa7, newSources: qa7New } = await runGapAnalysisQA(ctx);

    qaResults.push(qa1, qa2, qa3, qa4, qa5, qa6, qa7);

    // DO NOT OVER-RESEARCH: once the seed is resolved and the official site,
    // a phone and a location are verified, more sources cannot make the
    // identity more correct -- they can only contaminate it.
    const sufficient = !!seedEntity?.resolved && !!officialWebsite && extracted.contactMethods.some((c) => c.type === "phone" && c.value) && extracted.locations.some((l) => l.city || l.state);
    const newSourcesTotal: QueuedSource[] = sufficient ? [] : [...qa3New, ...qa7New].filter((src) => !isPlatformBoilerplateUrl(src.url));
    if (newSourcesTotal.length === 0 || cycle === MAX_QA_REOPEN_CYCLES || visited.size >= MAX_TOTAL_SOURCES) {
      await onStage?.("QA_8", { sourcesFound: visited.size });
      qaResults.push(runFinalProfileQA(ctx, queue.length === 0));
      break;
    }

    // QA found something real the graph missed -- reopen and process it
    // through the SAME per-node pipeline (primary + verification +
    // website-subpage detection all apply identically here).
    for (const src of newSourcesTotal) enqueue(src.url, src.discoveredFrom, src.discoveryMethod, 0);
    await drainQueue();
    allPages = Array.from(visited.values());
    extracted = await aggregate();
  }

  await onStage?.("BUILDING_PROFILE", { sourcesFound: visited.size });

  const sourceChecks: SourceCheck[] = sourceLog.map((s) => ({ sourceUrl: s.url, sourceType: s.sourceType, reachable: s.fetchStatus === "ok", reason: s.blockedReason }));

  // ---- Facebook-recovery instrumentation (per-job telemetry) ----
  // Answers, with real numbers instead of anecdotes: what % of Facebook
  // seeds complete research, how often mbasic saves a blocked job, and
  // which seed URL shapes fail most. Based on the PRIMARY seed only — a
  // multi-source submission's later sources don't change what "the seed"
  // was for classification purposes.
  const primarySeed = seedSources[0] ?? "";
  const seedUrlType = classifySeedUrlType(primarySeed);
  const isFacebookSeed = seedUrlType === "vanity" || seedUrlType === "profile_id" || seedUrlType === "pages" || seedUrlType === "people";
  const seedAttempts = seedPageByUrl.get(primarySeed)?.fetchAttempts ?? [];
  const directAttempt = seedAttempts.find((a) => a.strategy === "direct");
  const mbasicAttempt = seedAttempts.find((a) => a.strategy === "mbasic_fallback");
  const outcomeOf = (a: typeof directAttempt): FetchOutcome => (!a ? "not_applicable" : a.ok ? "success" : "blocked");

  const instrumentation: ResearchInstrumentation = {
    seedUrlType,
    facebookFetchResult: isFacebookSeed ? outcomeOf(directAttempt) : "not_applicable",
    mbasicFallbackUsed: !!mbasicAttempt,
    mbasicFallbackResult: isFacebookSeed ? outcomeOf(mbasicAttempt) : "not_applicable",
    identityRecoveredFromUrl: extractHandleFromSeeds(seedSources) !== null,
    identityRecoveredFromSecondarySource: websiteDiscovery?.status === "found",
    discoveryProviderUsed: websiteDiscovery && "provider" in websiteDiscovery ? websiteDiscovery.provider : null,
    sourcesVerified: sourceLog.filter((s) => s.fetchStatus === "ok").length,
  };

  const graph: BusinessGraph = {
    ...extracted,
    ...(seedEntity ? { seedEntity } : {}),
    sourceChecks,
    sourceLog,
    qaResults,
    ...(socialRecovery ? { socialRecovery } : {}),
    ...(websiteDiscovery
      ? {
          websiteDiscovery: {
            status: websiteDiscovery.status,
            provider: "provider" in websiteDiscovery ? websiteDiscovery.provider : null,
            reason: websiteDiscovery.status === "discovery_unavailable" ? websiteDiscovery.reason : null,
            queriesRun: "queriesRun" in websiteDiscovery ? websiteDiscovery.queriesRun : [],
          },
        }
      : {}),
  };

  return { graph, allPages, instrumentation };
}

function normalizeResolved(r: Resolved<string>) {
  return { value: r.value, status: r.status, confidence: r.confidence, sourceUrl: r.sources[0] || null };
}
