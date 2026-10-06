import type { DiscoveryProvider, DiscoveryResult } from "../providers/types";
import { getAvailableDiscoveryProvider } from "../providers/registry";
import { classifyDiscoveryResult } from "../discovery/resultClassifier";
import { canonicalDomain } from "../normalize";
import type { SocialAdapter } from "./adapters";

// ============================================================
// PUBLIC-INDEX RECOVERY (platform-agnostic)
//
// When a social seed page is login-walled to non-browser clients, read what
// the open web already indexes about that EXACT account: its own public
// posts/pages, and third-party pages that link to the exact profile URL
// (official website footer / JSON-LD sameAs, directories). Every result is
// attributed through the adapter's exact-handle rule; backlink candidates
// are handed to the discovery graph to be fetched and verified like any
// other source. This reads an index; it never bypasses a login.
// ============================================================

export type IndexedPost = { url: string; title: string | null; caption: string | null };
export type PublicIndexParse = {
  platform: string;
  handle: string;
  displayName: string | null;
  posts: IndexedPost[];
  websiteCandidates: string[];
  directoryCandidates: string[];
  captionText: string;
  phones: string[];
  emails: string[];
  mentionedUrls: string[];
};
export type PublicIndexOutcome =
  | ({ status: "found"; provider: string; queriesRun: string[] } & PublicIndexParse)
  | { status: "not_found"; provider: string; queriesRun: string[]; handle: string; platform: string }
  | { status: "unavailable"; reason: string; handle: string; platform: string };

const PHONE_RE = /(?:\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g;
const EMAIL_RE = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi;
const URL_RE = /\b(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|co|us|biz|io|services|llc|ca)\b(?:\/[^\s"')]*)?/gi;

export function parsePublicIndexResults(adapter: SocialAdapter, handle: string, results: DiscoveryResult[]): PublicIndexParse {
  const posts: IndexedPost[] = [];
  const websiteCandidates: string[] = [];
  const directoryCandidates: string[] = [];
  let displayName: string | null = null;
  const seenDomains = new Set<string>();
  const ownDomains = new Set(adapter.indexDomains);
  for (const r of results) {
    const domain = (canonicalDomain(r.url) || "").toLowerCase();
    if (ownDomains.has(domain) || Array.from(ownDomains).some((d) => domain.endsWith(`.${d}`))) {
      if (!adapter.resultBelongsToHandle(r, handle)) continue;
      const parsed = adapter.parseIndexTitle(r.title, r.description, handle);
      if (parsed.displayName && !displayName) displayName = parsed.displayName;
      posts.push({ url: r.url, title: r.title ?? null, caption: parsed.text });
      continue;
    }
    if (!domain || seenDomains.has(domain)) continue;
    const cls = classifyDiscoveryResult(r);
    if (cls === "official_website_candidate") { seenDomains.add(domain); websiteCandidates.push(r.url); }
    else if (cls === "directory") { seenDomains.add(domain); directoryCandidates.push(r.url); }
  }
  const captionText = posts.map((p) => p.caption ?? "").filter(Boolean).join(" • ");
  const phones = Array.from(new Set((captionText.match(PHONE_RE) ?? []).map((x) => x.trim())));
  const emails = Array.from(new Set((captionText.match(EMAIL_RE) ?? []).map((x) => x.toLowerCase())));
  const mentionedUrls = Array.from(new Set((captionText.match(URL_RE) ?? []).map((x) => x.replace(/[.,]$/, "")))).filter((u) => !ownDomains.has((canonicalDomain(u) || "").toLowerCase()));
  return { platform: adapter.platform, handle, displayName, posts, websiteCandidates: websiteCandidates.slice(0, 3), directoryCandidates: directoryCandidates.slice(0, 3), captionText, phones, emails, mentionedUrls };
}

export async function recoverFromPublicIndex(seedUrl: string, adapter: SocialAdapter, providerOverride?: DiscoveryProvider | null): Promise<PublicIndexOutcome> {
  const handle = adapter.handleFromUrl(seedUrl);
  if (!handle) return { status: "unavailable", reason: `Seed is not a ${adapter.platform} profile URL.`, handle: "", platform: adapter.platform };
  const provider = providerOverride === undefined ? getAvailableDiscoveryProvider() : providerOverride;
  if (!provider) return { status: "unavailable", reason: "No discovery provider is configured (e.g. EXA_API_KEY).", handle, platform: adapter.platform };

  const queriesRun: string[] = [];
  let results: DiscoveryResult[] = [];
  // Query 1: the exact profile URL(s) as a phrase -- own posts + every page
  // on the web that links to that exact account.
  for (const q of adapter.indexPhrases(handle).slice(0, 2)) {
    queriesRun.push(q);
    results = results.concat(await provider.search({ query: q, maxResults: 10 }));
  }
  let parsed = parsePublicIndexResults(adapter, handle, results);
  // Query 2: only if nothing of the account's own surfaced -- the bare handle
  // scoped to the platform's domains.
  if (parsed.posts.length === 0) {
    const bare = handle.includes("/") ? handle.split("/").pop()! : handle;
    const q2 = `"${bare}"`;
    queriesRun.push(q2);
    results = results.concat(await provider.search({ query: q2, maxResults: 8, domains: adapter.indexDomains }));
    parsed = parsePublicIndexResults(adapter, handle, results);
  }
  if (parsed.posts.length === 0 && parsed.websiteCandidates.length === 0 && parsed.directoryCandidates.length === 0) {
    return { status: "not_found", provider: provider.id, queriesRun, handle, platform: adapter.platform };
  }
  return { status: "found", provider: provider.id, queriesRun, ...parsed };
}
