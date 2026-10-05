import type { DiscoveryProvider, DiscoveryResult } from "./providers/types";
import { getAvailableDiscoveryProvider } from "./providers/registry";
import { classifyDiscoveryResult } from "./discovery/resultClassifier";
import { canonicalDomain } from "./normalize";

// ============================================================
// INSTAGRAM PUBLIC-INDEX RECOVERY
//
// instagram.com/<handle> redirects every non-browser client to the login
// page (verified: both a bot UA and a desktop Chrome UA get HTTP 200 with
// "Create an account or log in to Instagram" and zero profile data). We do
// not bypass that. What IS public is what the open web already indexes:
// the account's public post pages ("<Name> on Instagram: "<caption>"" ...
// "More posts from <handle>") and third-party pages that link to the exact
// instagram.com/<handle> URL (the official website's footer / JSON-LD
// sameAs, directories). This module reads only that, ties every result to
// the EXACT handle, and hands backlink pages to the discovery graph, which
// fetches and verifies them like any other source.
// ============================================================

export type InstagramPost = { url: string; title: string | null; caption: string | null };
export type InstagramIndexParse = {
  handle: string;
  displayName: string | null;
  posts: InstagramPost[];
  /** Non-social, non-infra, non-directory URLs returned for the exact
   * instagram.com/<handle> query -- official-website candidates. */
  websiteCandidates: string[];
  /** Directory/review pages returned for the exact handle query. */
  directoryCandidates: string[];
  captionText: string;
  phones: string[];
  emails: string[];
  mentionedUrls: string[];
};
export type InstagramRecoveryOutcome =
  | ({ status: "found"; provider: string; queriesRun: string[] } & InstagramIndexParse)
  | { status: "not_found"; provider: string; queriesRun: string[]; handle: string }
  | { status: "unavailable"; reason: string; handle: string };

export function instagramHandleFromUrl(url: string): string | null {
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    const host = u.hostname.toLowerCase().replace(/^www\.|^m\./, "");
    if (host !== "instagram.com") return null;
    const segs = u.pathname.split("/").filter(Boolean);
    const first = segs[0]?.toLowerCase().replace(/^@/, "");
    if (!first || IG_RESERVED.has(first)) return null;
    if (!/^[a-z0-9._]{1,30}$/.test(first)) return null;
    return first;
  } catch {
    return null;
  }
}
const IG_RESERVED = new Set(["p", "reel", "reels", "explore", "accounts", "stories", "tv", "direct", "about", "legal", "privacy", "terms", "help", "developer", "developers", "press", "api", "blog", "web", "nametag", "ar", "locations", "tags", "popular"]);

const PHONE_RE = /(?:\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g;
const EMAIL_RE = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi;
const URL_RE = /\b(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|co|us|biz|io|services|llc)\b(?:\/[^\s"')]*)?/gi;

/** Does this search result belong to the EXACT handle? URL path, the
 * "More posts from <handle>" footer, or a "<handle> on Instagram:" title --
 * never a similar-looking name. */
export function resultBelongsToHandle(r: DiscoveryResult, handle: string): boolean {
  const h = handle.toLowerCase();
  try {
    const u = new URL(r.url);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    if (host !== "instagram.com") return false;
    const segs = u.pathname.split("/").filter(Boolean).map((x) => x.toLowerCase());
    if (segs[0] === h) return true;
  } catch {
    return false;
  }
  const text = `${r.title ?? ""}\n${r.description ?? ""}`;
  if (new RegExp(`more posts from ${escapeRe(h)}\\b`, "i").test(text)) return true;
  if (new RegExp(`^${escapeRe(h)} on instagram`, "i").test((r.title ?? "").trim())) return true;
  return false;
}
function escapeRe(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

export function parseInstagramIndexResults(handle: string, results: DiscoveryResult[]): InstagramIndexParse {
  const posts: InstagramPost[] = [];
  const websiteCandidates: string[] = [];
  const directoryCandidates: string[] = [];
  let displayName: string | null = null;
  const seenDomains = new Set<string>();
  for (const r of results) {
    const domain = (canonicalDomain(r.url) || "").toLowerCase();
    if (domain === "instagram.com") {
      if (!resultBelongsToHandle(r, handle)) continue;
      const m = (r.title ?? "").match(/^(.+?) on Instagram:\s*"?([\s\S]*?)"?\s*$/i);
      const name = m?.[1]?.trim() ?? null;
      if (name && !displayName && name.toLowerCase() !== "instagram") displayName = name;
      const caption = (m?.[2] ?? r.description ?? "").replace(/\s+/g, " ").replace(/\b(Like|Reply|Follow|Log in to like or comment\.|More posts from \S+)\b/g, " ").replace(/\s+/g, " ").trim() || null;
      posts.push({ url: r.url, title: r.title ?? null, caption });
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
  const mentionedUrls = Array.from(new Set((captionText.match(URL_RE) ?? []).map((x) => x.replace(/[.,]$/, ""))));
  return { handle, displayName, posts, websiteCandidates: websiteCandidates.slice(0, 3), directoryCandidates: directoryCandidates.slice(0, 3), captionText, phones, emails, mentionedUrls };
}

export async function recoverInstagramFromPublicIndex(seedUrl: string, providerOverride?: DiscoveryProvider | null): Promise<InstagramRecoveryOutcome> {
  const handle = instagramHandleFromUrl(seedUrl);
  if (!handle) return { status: "unavailable", reason: "Seed is not an Instagram profile URL.", handle: "" };
  const provider = providerOverride === undefined ? getAvailableDiscoveryProvider() : providerOverride;
  if (!provider) return { status: "unavailable", reason: "No discovery provider is configured (e.g. EXA_API_KEY).", handle };

  // Query 1 -- the exact profile URL as a phrase. Finds the account's own
  // indexed posts AND every page on the web that links to that exact
  // account (website footer, JSON-LD sameAs, directories).
  // Query 2 -- only if query 1 surfaced no posts: the bare handle, scoped to
  // instagram.com, for accounts whose posts rank but whose URL isn't quoted.
  const queriesRun: string[] = [];
  const q1 = `"instagram.com/${handle}"`;
  queriesRun.push(q1);
  let results = await provider.search({ query: q1, maxResults: 10 });
  let parsed = parseInstagramIndexResults(handle, results);
  if (parsed.posts.length === 0) {
    const q2 = `"${handle}"`;
    queriesRun.push(q2);
    const more = await provider.search({ query: q2, maxResults: 8, domains: ["instagram.com"] });
    results = [...results, ...more];
    parsed = parseInstagramIndexResults(handle, results);
  }
  if (parsed.posts.length === 0 && parsed.websiteCandidates.length === 0 && parsed.directoryCandidates.length === 0) {
    return { status: "not_found", provider: provider.id, queriesRun, handle };
  }
  return { status: "found", provider: provider.id, queriesRun, ...parsed };
}
