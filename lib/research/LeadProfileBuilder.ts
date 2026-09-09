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
import type { BusinessGraph, Candidate, FetchedPage, SourceCheck, SourceLogEntry, QAPassResult } from "./types";
import { fetchPage } from "./fetchSource";
import { discoverLinks } from "./LinkDiscoveryService";
import { discoverContacts } from "./ContactDiscoveryService";
import { discoverLocations } from "./LocationDiscoveryService";
import { discoverSocialProfiles } from "./SocialDiscoveryService";
import { resolveField, type Resolved } from "./EvidenceValidator";
import { extractTitle, extractMeta, extractJsonLd, findLocalBusiness, decodeEntities, extractLinks } from "./htmlExtract";
import { classifyLink, canonicalDomain } from "./normalize";
import { classifyCategoryHeuristic } from "./CategoryClassifier";
import { discoverOfficialWebsite, type WebsiteDiscoveryOutcome } from "./discovery/websiteDiscovery";
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

function urlKey(url: string): string {
  return canonicalDomain(url) || url.toLowerCase();
}

const HANDLE_HOSTS = ["facebook.com", "instagram.com", "tiktok.com", "x.com", "twitter.com"];
const NON_HANDLE_SEGMENTS = new Set(["profile.php", "pages", "people", "share"]);

/** Pulls a username/handle straight out of a seed social URL -- this is
 * real identity evidence even when the page itself can't be fetched (e.g.
 * a blocked Facebook profile), and it's the strongest signal the query
 * generator can use. */
function extractHandleFromSeeds(seedSources: string[]): string | null {
  for (const s of seedSources) {
    try {
      const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
      const host = u.hostname.replace(/^www\.|^m\./, "");
      if (!HANDLE_HOSTS.includes(host)) continue;
      const seg = u.pathname.split("/").filter(Boolean)[0];
      if (seg && !NON_HANDLE_SEGMENTS.has(seg)) return seg;
    } catch {
      // not a URL — nothing to extract
    }
  }
  return null;
}

/** Same-domain links matching a business-information page type — the
 * queue-native replacement for the old fixed "crawl exactly 6 pages"
 * helper. Runs against ANY page that turns out to be the official website,
 * however many hops from the seed it was discovered. */
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
  return Array.from(new Set(matches));
}

export async function buildLeadProfile(
  seedSources: string[],
  onStage?: ResearchStageUpdate,
  scope: ResearchScope = "public_web"
): Promise<{ graph: BusinessGraph; allPages: FetchedPage[] }> {
  const skipExpansion = scope === "website_only" || scope === "quick_contact";
  const skipLocationsAndSocials = scope === "quick_contact";

  const visited = new Map<string, FetchedPage>();
  const sourceLog: SourceLogEntry[] = [];
  const queuedKeys = new Set<string>();
  const queue: QueueItem[] = [];
  let officialWebsite: string | null = null;
  let websiteSubPagesQueued = false;

  function enqueue(url: string, discoveredFrom: string | null, discoveryMethod: SourceLogEntry["discoveryMethod"], depth: number) {
    const key = urlKey(url);
    if (queuedKeys.has(key) || visited.has(key) || depth > MAX_DEPTH) return;
    queuedKeys.add(key);
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
    if (!page.ok) return;

    // PRIMARY EXTRACTION
    const primary = discoverLinks(page);
    logEntry.primaryPassDone = true;
    if (!officialWebsite && primary.officialWebsite) officialWebsite = primary.officialWebsite;
    if (!skipExpansion) {
      for (const bioUrl of primary.linkInBioPages) enqueue(bioUrl, item.url, "bio_link", item.depth + 1);
      for (const s of primary.socials) enqueue(s.url, item.url, "social_link", item.depth + 1);
    }

    // VERIFICATION EXTRACTION — independently re-scans every raw href on
    // the SAME page (not filtered by primary's self-domain/kind branching)
    // so a bio-link or social host primary's ordering happened to skip
    // still gets caught before this source is marked done.
    await onStage?.("VERIFYING_SOURCES", { sourcesFound: visited.size });
    if (!skipExpansion) {
      for (const link of extractLinks(page.html, page.finalUrl)) {
        const cls = classifyLink(link);
        if (cls.kind === "linktree") enqueue(link, item.url, "bio_link", item.depth + 1);
        if (cls.kind === "social") enqueue(link, item.url, "social_link", item.depth + 1);
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
    if (officialWebsite && urlKey(page.finalUrl) === urlKey(officialWebsite) && !websiteSubPagesQueued) {
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

  await drainQueue();
  let allPages = Array.from(visited.values());

  // ---- AGGREGATE EXTRACTION over the full discovery-graph result ----
  async function aggregate() {
    await onStage?.("EXTRACTING_CONTACTS", { sourcesFound: visited.size });
    const bookingLinks: string[] = [];
    for (const page of allPages) {
      if (!page.ok) continue;
      bookingLinks.push(...discoverLinks(page).bookingLinks);
    }
    const contacts = discoverContacts(allPages, Array.from(new Set(bookingLinks)));

    await onStage?.("EXTRACTING_LOCATIONS", { sourcesFound: visited.size });
    const locations = skipLocationsAndSocials ? [] : discoverLocations(allPages);

    await onStage?.("EXTRACTING_SOCIALS", { sourcesFound: visited.size });
    const socialProfiles = skipLocationsAndSocials ? [] : discoverSocialProfiles(allPages);

    await onStage?.("CLASSIFYING_BUSINESS", { sourcesFound: visited.size });
    const nameCandidates: Candidate[] = [];
    const categoryCandidates: Candidate[] = [];
    let description: string | null = null;
    let ownerName: string | null = null;
    const services = new Set<string>();
    let hasJsonLd = false;
    let hasMetaDescription = false;
    let hasAggregateRating = false;

    for (const page of allPages) {
      if (!page.ok) continue;
      const title = extractTitle(page.html);
      const ogTitle = extractMeta(page.html, "og:title");
      const metaDesc = extractMeta(page.html, "description") || extractMeta(page.html, "og:description");
      if (metaDesc) {
        hasMetaDescription = true;
        if (!description) description = metaDesc;
      }
      const jsonLd = extractJsonLd(page.html);
      const localBusiness = findLocalBusiness(jsonLd);
      if (jsonLd.length > 0) hasJsonLd = true;
      if (jsonLd.some((b) => !!b["aggregateRating"])) hasAggregateRating = true;

      if (localBusiness?.name) nameCandidates.push({ value: decodeEntities(String(localBusiness.name)), sourceUrl: page.finalUrl, sourceType: page.sourceType, strength: 3 });
      if (ogTitle) nameCandidates.push({ value: decodeEntities(ogTitle.split(/[|–—-]/)[0]), sourceUrl: page.finalUrl, sourceType: page.sourceType, strength: 2 });
      if (title) nameCandidates.push({ value: decodeEntities(title.split(/[|–—-]/)[0]), sourceUrl: page.finalUrl, sourceType: page.sourceType, strength: 1 });

      const schemaType = localBusiness?.["@type"];
      if (schemaType) categoryCandidates.push({ value: String(Array.isArray(schemaType) ? schemaType[0] : schemaType), sourceUrl: page.finalUrl, sourceType: page.sourceType, strength: 2 });

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

    const heuristicCategory = classifyCategoryHeuristic(allPages);
    if (heuristicCategory) categoryCandidates.push(heuristicCategory);

    const name = resolveField(nameCandidates);
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
      businessName: name.value ? { value: name.value, sourceUrl: name.sources[0] || "", sourceType: "website" as const, strength: 3 } : null,
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
    websiteDiscovery = await discoverOfficialWebsite({
      businessName: extracted.businessName?.value ?? null,
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

    const newSourcesTotal: QueuedSource[] = [...qa3New, ...qa7New];
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

  const graph: BusinessGraph = {
    ...extracted,
    sourceChecks,
    sourceLog,
    qaResults,
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

  return { graph, allPages };
}

function normalizeResolved(r: Resolved<string>) {
  return { value: r.value, status: r.status, confidence: r.confidence, sourceUrl: r.sources[0] || null };
}
