// The 8 QA passes required to consider a Deep Research job actually
// complete. "Complete" no longer means "the seed page finished" -- it means
// these 8 checks ran, and if pass 3 (External Link QA) or pass 7 (Gap
// Analysis QA) find something the discovery graph missed, the coordinator
// re-opens the queue and processes it BEFORE the job can finish. Every other
// pass is a pure inspection (it reports issues but does not reopen research)
// -- deliberately so: only a pass that finds a concrete new SOURCE gets to
// extend the job, never a pass that just dislikes a result.
import type { BusinessGraph, FetchedPage, QAPassResult, SocialPlatform } from "./types";
import { extractLinks } from "./htmlExtract";
import { classifyLink, canonicalDomain, pageKey } from "./normalize";
import { isPublicSearchConfigured, publicSearch } from "./PublicSearchService";
import { buildFingerprint, matchesFingerprint, type IdentityFingerprint } from "./BusinessIdentityResolver";

const SOCIAL_PLATFORMS: SocialPlatform[] = ["facebook", "instagram", "tiktok", "linkedin", "youtube", "x"];

export type QueuedSource = { url: string; discoveredFrom: string; discoveryMethod: "qa_reopen" | "gap_analysis" };

export type QAContext = {
  graph: Pick<BusinessGraph, "businessName" | "category" | "contactMethods" | "locations" | "socialProfiles">;
  visitedPages: FetchedPage[];
  queuedUrlKeys: Set<string>; // every URL ever seen (queued OR visited), by canonical key
  officialWebsite: string | null;
};

// Same crawl-frontier identity as LeadProfileBuilder.ts's urlKey() -- must
// stay page-level, not domain-level, or QA passes 3/7 will think a new page
// on an already-visited domain is a duplicate and never reopen research for
// it. See normalize.ts's pageKey() doc comment for the full rationale.
function urlKey(url: string): string {
  return pageKey(url);
}

export function runIdentityQA(ctx: QAContext): QAPassResult {
  const issues: string[] = [];
  if (!ctx.graph.businessName?.value) issues.push("Business name could not be resolved from any visited source.");
  return { pass: 1, name: "Identity QA", passed: issues.length === 0, issues, newSourcesFound: 0 };
}

export function runContactQA(ctx: QAContext): QAPassResult {
  const issues: string[] = [];
  for (const type of ["phone", "email", "website", "whatsapp", "booking"] as const) {
    const m = ctx.graph.contactMethods.find((c) => c.type === type);
    if (!m || m.status === "not_found") issues.push(`${type} not found after checking all visited sources.`);
  }
  // Contact QA is informational, not a hard failure -- a real business
  // legitimately may not publish a booking link or WhatsApp anywhere public.
  return { pass: 2, name: "Contact QA", passed: true, issues, newSourcesFound: 0 };
}

/** Re-scans every visited page's raw HTML for bio-link/social hosts that
 * were never queued -- catches exactly the class of bug that motivated this
 * engine: a discovery made on some page getting silently dropped instead of
 * entering the queue. */
export function runExternalLinkQA(ctx: QAContext): { result: QAPassResult; newSources: QueuedSource[] } {
  const issues: string[] = [];
  const newSources: QueuedSource[] = [];
  const seen = new Set<string>();

  for (const page of ctx.visitedPages) {
    if (!page.ok) continue;
    for (const link of extractLinks(page.html, page.finalUrl)) {
      const cls = classifyLink(link);
      if (cls.kind !== "linktree" && cls.kind !== "social") continue;
      const key = urlKey(link);
      if (ctx.queuedUrlKeys.has(key) || seen.has(key)) continue;
      seen.add(key);
      newSources.push({ url: link, discoveredFrom: page.finalUrl, discoveryMethod: "qa_reopen" });
    }
  }

  if (newSources.length > 0) issues.push(`Found ${newSources.length} link-bearing destination(s) that were discovered but never processed — reopening research.`);
  return { result: { pass: 3, name: "External Link QA", passed: newSources.length === 0, issues, newSourcesFound: newSources.length }, newSources };
}

export function runWebsiteQA(ctx: QAContext): QAPassResult {
  const issues: string[] = [];
  if (!ctx.officialWebsite) {
    issues.push("No official website could be identified from any visited source.");
  } else {
    const visited = ctx.visitedPages.some((p) => urlKey(p.finalUrl) === urlKey(ctx.officialWebsite!) && p.ok);
    if (!visited) issues.push("An official website was identified but could not be successfully fetched.");
  }
  return { pass: 4, name: "Website QA", passed: issues.length === 0, issues, newSourcesFound: 0 };
}

export function runSocialPresenceQA(ctx: QAContext): QAPassResult {
  const issues: string[] = [];
  for (const platform of SOCIAL_PLATFORMS) {
    if (!ctx.graph.socialProfiles.some((s) => s.platform === platform)) issues.push(`${platform} not found on any visited source.`);
  }
  return { pass: 5, name: "Social Presence QA", passed: true, issues, newSourcesFound: 0 };
}

export function runLocationServiceQA(ctx: QAContext): QAPassResult {
  const issues: string[] = [];
  if (!ctx.graph.locations.some((l) => l.locationType === "primary")) issues.push("No primary address found on any visited source.");
  if (!ctx.graph.locations.some((l) => l.locationType === "service_area")) issues.push("No service area mentions found.");
  if (!ctx.graph.category) issues.push("Category not yet classified.");
  return { pass: 6, name: "Location & Service QA", passed: true, issues, newSourcesFound: 0 };
}

/** The one pass allowed to go looking for genuinely NEW sources beyond what
 * the discovery graph already found -- only runs a public search (when
 * configured) for concrete, named gaps, and only accepts a hit that matches
 * the identity fingerprint already confirmed via direct crawling. */
export async function runGapAnalysisQA(ctx: QAContext): Promise<{ result: QAPassResult; newSources: QueuedSource[] }> {
  const issues: string[] = [];
  const newSources: QueuedSource[] = [];

  const gaps: string[] = [];
  if (!ctx.graph.category) gaps.push("category");
  if (!ctx.graph.contactMethods.find((c) => c.type === "email" && c.status !== "not_found")) gaps.push("email");
  if (ctx.graph.socialProfiles.length === 0) gaps.push("social profiles");

  if (gaps.length === 0) {
    return { result: { pass: 7, name: "Gap Analysis QA", passed: true, issues: ["No meaningful gaps identified."], newSourcesFound: 0 }, newSources };
  }

  issues.push(`Identified gaps a salesperson would expect answered: ${gaps.join(", ")}.`);

  if (!isPublicSearchConfigured() || !ctx.graph.businessName?.value) {
    issues.push("Public search expansion is not configured — gaps recorded but not further investigated.");
    return { result: { pass: 7, name: "Gap Analysis QA", passed: false, issues, newSourcesFound: 0 }, newSources };
  }

  const website = ctx.graph.contactMethods.find((c) => c.type === "website")?.value || null;
  const phone = ctx.graph.contactMethods.find((c) => c.type === "phone")?.value || null;
  const fingerprint: IdentityFingerprint = buildFingerprint({ name: ctx.graph.businessName.value, domain: website ? canonicalDomain(website) : null, phone });

  const results = await publicSearch(`"${ctx.graph.businessName.value}" ${gaps.join(" OR ")}`, 6);
  const seen = new Set<string>();
  for (const r of results) {
    if (!matchesFingerprint(fingerprint, { text: `${r.title} ${r.snippet}`, domain: canonicalDomain(r.url) || undefined })) continue;
    const key = urlKey(r.url);
    if (ctx.queuedUrlKeys.has(key) || seen.has(key)) continue;
    seen.add(key);
    newSources.push({ url: r.url, discoveredFrom: "gap_analysis_search", discoveryMethod: "gap_analysis" });
  }

  if (newSources.length > 0) issues.push(`Gap analysis search found ${newSources.length} additional plausible source(s) — reopening research.`);
  return { result: { pass: 7, name: "Gap Analysis QA", passed: newSources.length === 0, issues, newSourcesFound: newSources.length }, newSources };
}

export function runFinalProfileQA(ctx: QAContext, queueDrained: boolean): QAPassResult {
  const issues: string[] = [];
  if (!queueDrained) issues.push("Discovery queue was not fully drained before finalization (safety limit reached).");
  return { pass: 8, name: "Final Profile QA", passed: issues.length === 0, issues, newSourcesFound: 0 };
}
