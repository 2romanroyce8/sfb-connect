import type { BusinessGraph, Candidate, FetchedPage, SourceCheck } from "./types";
import { fetchPage } from "./fetchSource";
import { discoverLinks } from "./LinkDiscoveryService";
import { crawlWebsite } from "./WebsiteCrawler";
import { discoverContacts } from "./ContactDiscoveryService";
import { discoverLocations } from "./LocationDiscoveryService";
import { discoverSocialProfiles } from "./SocialDiscoveryService";
import { resolveField, type Resolved } from "./EvidenceValidator";
import { buildFingerprint, matchesFingerprint } from "./BusinessIdentityResolver";
import { isPublicSearchConfigured, publicSearch } from "./PublicSearchService";
import { extractTitle, extractMeta, extractJsonLd, findLocalBusiness, decodeEntities } from "./htmlExtract";
import { classifyLink, canonicalDomain } from "./normalize";
import { classifyCategoryHeuristic } from "./CategoryClassifier";
import type { ResearchStage } from "./jobProgress";

export type ResearchStageUpdate = (stage: ResearchStage, meta?: { sourcesFound?: number }) => Promise<void> | void;

// Real scope differences, not cosmetic labels:
//  - "website_only" / "quick_contact" skip link-in-bio expansion and public
//    search widening -- the whole point of restricting to what was
//    submitted rather than fanning out to discover more sources.
//  - "quick_contact" additionally skips location/social discovery entirely,
//    returning only identity + contact channels, faster and narrower.
//  - "public_web", "social_profile", "google_business" all run the full
//    fan-out; the seed URL variety doesn't change the discovery breadth,
//    just what kind of page the fan-out starts from.
export type ResearchScope = "public_web" | "website_only" | "social_profile" | "google_business" | "quick_contact";

/**
 * Orchestrates every discovery service into one canonical BusinessGraph.
 * The submitted URL(s) are a SEED, not the final answer -- this follows
 * official-website links, crawls priority pages, and (optionally, only if
 * EXA_API_KEY is configured) expands into public search, all while keeping
 * "source unavailable" distinct from "not found".
 */
export async function buildLeadProfile(
  seedSources: string[],
  onStage?: ResearchStageUpdate,
  scope: ResearchScope = "public_web"
): Promise<{ graph: BusinessGraph; allPages: FetchedPage[] }> {
  const skipExpansion = scope === "website_only" || scope === "quick_contact";
  const skipLocationsAndSocials = scope === "quick_contact";
  const sourceChecks: SourceCheck[] = [];
  const seedPages: FetchedPage[] = [];

  await onStage?.("IDENTIFYING_BUSINESS");
  for (const src of seedSources) {
    const page = await fetchPage(src);
    seedPages.push(page);
    sourceChecks.push({ sourceUrl: page.url, sourceType: page.sourceType, reachable: page.ok, reason: page.ok ? undefined : page.blockedReason });
  }

  await onStage?.("DISCOVERING_SOURCES", { sourcesFound: sourceChecks.length });
  let officialWebsite: string | null = null;
  const linkInBioPages: string[] = [];
  const bookingLinks: string[] = [];
  for (const page of seedPages) {
    if (!page.ok) continue;
    const discovered = discoverLinks(page);
    if (!officialWebsite && discovered.officialWebsite) officialWebsite = discovered.officialWebsite;
    linkInBioPages.push(...discovered.linkInBioPages);
    bookingLinks.push(...discovered.bookingLinks);
  }

  let crawledPages: FetchedPage[] = [];
  if (officialWebsite) {
    await onStage?.("READING_WEBSITE", { sourcesFound: sourceChecks.length });
    crawledPages = await crawlWebsite(officialWebsite);
    for (const p of crawledPages) {
      sourceChecks.push({ sourceUrl: p.url, sourceType: p.sourceType, reachable: p.ok, reason: p.ok ? undefined : p.blockedReason });
    }
  }

  const bioPages: FetchedPage[] = [];
  if (!skipExpansion) {
    for (const url of Array.from(new Set(linkInBioPages)).slice(0, 2)) {
      const page = await fetchPage(url);
      bioPages.push(page);
      sourceChecks.push({ sourceUrl: page.url, sourceType: page.sourceType, reachable: page.ok, reason: page.ok ? undefined : page.blockedReason });
      if (page.ok) {
        const discovered = discoverLinks(page);
        bookingLinks.push(...discovered.bookingLinks);
        // A link-in-bio page's own social/website links are treated as if
        // they came from the official site itself -- that's the whole point
        // of a bio-link page.
      }
    }
  }

  const allPages = [...seedPages, ...crawledPages, ...bioPages];

  await onStage?.("EXTRACTING_CONTACTS", { sourcesFound: sourceChecks.length });
  const contacts = discoverContacts(allPages, Array.from(new Set(bookingLinks)));

  await onStage?.("EXTRACTING_LOCATIONS", { sourcesFound: sourceChecks.length });
  const locations = skipLocationsAndSocials ? [] : discoverLocations(allPages);

  await onStage?.("EXTRACTING_SOCIALS", { sourcesFound: sourceChecks.length });
  let socialProfiles = skipLocationsAndSocials ? [] : discoverSocialProfiles(allPages);

  await onStage?.("CLASSIFYING_BUSINESS", { sourcesFound: sourceChecks.length });

  // ---- Identity fields (single-value, resolved across all pages) ----
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

  // Fallback: if no page published schema.org markup with a recognized
  // @type (the common case for small-business sites), fall back to a
  // title/heading/nav keyword heuristic rather than leaving category
  // permanently "Not found" just because the site has no JSON-LD. This
  // candidate is strength 1 -- schema-derived candidates (strength 2) always
  // win when both exist; resolveField marks a heuristic-only result
  // "uncertain" rather than "verified", which is the honest distinction.
  const heuristicCategory = classifyCategoryHeuristic(allPages);
  if (heuristicCategory) categoryCandidates.push(heuristicCategory);

  const name = resolveField(nameCandidates);
  const categoryResolved = resolveField(categoryCandidates);

  // ---- Optional Phase 8: broad public search expansion ----
  if (!skipExpansion && isPublicSearchConfigured() && name.value) {
    await onStage?.("IDENTIFYING_BUSINESS", { sourcesFound: sourceChecks.length });
    const fingerprint = buildFingerprint({ name: name.value, domain: officialWebsite ? canonicalDomain(officialWebsite) : null, phone: contacts.phone[0]?.value || null });
    const results = await publicSearch(`"${name.value}" contact OR website OR instagram OR tiktok`, 6);
    for (const r of results) {
      if (!matchesFingerprint(fingerprint, { text: `${r.title} ${r.snippet}`, domain: canonicalDomain(r.url) || undefined })) continue;
      const cls = classifyLink(r.url);
      if (cls.kind === "social" && !socialProfiles.some((s) => s.platform === cls.platform)) {
        socialProfiles = [...socialProfiles, { platform: cls.platform, handle: null, url: r.url, displayName: r.title || null, status: "uncertain", confidence: 0.3, sourceUrl: r.url }];
      }
    }
  }

  await onStage?.("CROSS_VALIDATING", { sourcesFound: sourceChecks.length });
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

  await onStage?.("BUILDING_PROFILE", { sourcesFound: sourceChecks.length });
  const graph: BusinessGraph = {
    businessName: name.value ? { value: name.value, sourceUrl: name.sources[0] || "", sourceType: "website", strength: 3 } : null,
    category: categoryResolved.value,
    description,
    services: Array.from(services),
    ownerName,
    contactMethods,
    locations,
    socialProfiles,
    sourceChecks,
    signals: { hasJsonLd, hasHttps: !!officialWebsite?.startsWith("https://"), hasMetaDescription, hasAggregateRating },
  };

  return { graph, allPages };
}

function normalizeResolved(r: Resolved<string>) {
  return { value: r.value, status: r.status, confidence: r.confidence, sourceUrl: r.sources[0] || null };
}
