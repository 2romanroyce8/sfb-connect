import type { FetchedPage } from "../types";
import type { DiscoveryResult } from "../providers/types";
import { extractMeta, extractTitle, decodeEntities } from "../htmlExtract";
import { canonicalDomain } from "../normalize";

// ============================================================
// SOURCE ADAPTERS
//
// One research engine, many seeds. An adapter knows three things about its
// platform and nothing about the pipeline: (1) which exact account a URL
// names, (2) how to recognise that exact account in a public search index,
// and (3) what the platform's own public page actually publishes when it
// renders to a non-browser client. Everything downstream (discovery graph,
// entity classification, verification, conflicts, profile, audit) is
// shared. Empirically verified 2026-10-05:
//   facebook   Pages render (www or mbasic); profiles usually render.
//   instagram  profile page -> login redirect, zero data; posts indexed.
//   linkedin   /company/ renders with About facts; /in/ -> HTTP 999, but
//              the public index holds headline + experience text.
//   x          renders og:title "<Name> (@handle) on X" + og:description
//              (bio); nothing else without JS; not indexed itself.
//   tiktok     renders __UNIVERSAL_DATA_FOR_REHYDRATION__ with uniqueId,
//              nickname, signature (bio), bioLink, verified, commerceUser,
//              isOrganization, ttSeller -- real platform flags.
// ============================================================

export type SocialPlatform = "facebook" | "instagram" | "linkedin" | "x" | "tiktok";

export type ProfileExtract = {
  platform: SocialPlatform;
  handle: string | null;
  displayName: string | null;
  bio: string | null;
  headline: string | null;
  website: string | null;
  links: string[];
  location: string | null;
  category: string | null;
  flags: { business?: boolean; verified?: boolean; organization?: boolean; seller?: boolean; private?: boolean };
  companyFacts?: { industry?: string | null; size?: string | null; headquarters?: string | null; founded?: string | null; specialties?: string[]; website?: string | null };
  /** "company" / "school" / "person" for LinkedIn URL shapes; null elsewhere. */
  urlKind: string | null;
};

export interface SocialAdapter {
  platform: SocialPlatform;
  /** Exact account identifier from a URL, normalized (lowercase, no @). For
   * LinkedIn this is "company/<slug>" | "in/<slug>" | "school/<slug>". */
  handleFromUrl(url: string): string | null;
  /** Exact-URL phrases for the public-index query ("instagram.com/<h>"). */
  indexPhrases(handle: string): string[];
  /** Domains that host this account's own posts, for the handle-only fallback query. */
  indexDomains: string[];
  /** Does an index result belong to this EXACT account? Never a lookalike. */
  resultBelongsToHandle(result: DiscoveryResult, handle: string): boolean;
  /** Pull display name + body text out of an indexed post/page title. */
  parseIndexTitle(title: string | null, description: string | null, handle: string): { displayName: string | null; text: string | null };
  /** What the platform's own rendered page publishes, or null if it rendered nothing usable. */
  extractProfile(page: FetchedPage): ProfileExtract | null;
}

function urlOf(u: string): URL | null { try { return new URL(/^https?:\/\//i.test(u) ? u : `https://${u}`); } catch { return null; } }
function host(u: URL): string { return u.hostname.toLowerCase().replace(/^(www|m|mobile|mbasic)\./, ""); }
function segs(u: URL): string[] { return u.pathname.split("/").filter(Boolean); }
function esc(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function meta(page: FetchedPage, name: string): string | null { const v = extractMeta(page.html, name); return v ? decodeEntities(v).trim() || null : null; }

// ---------------- Instagram ----------------
const IG_RESERVED = new Set(["p", "reel", "reels", "explore", "accounts", "stories", "tv", "direct", "about", "legal", "privacy", "terms", "help", "developer", "developers", "press", "api", "blog", "web", "nametag", "ar", "locations", "tags", "popular"]);
export const instagramAdapter: SocialAdapter = {
  platform: "instagram",
  indexDomains: ["instagram.com"],
  handleFromUrl(url) {
    const u = urlOf(url); if (!u || host(u) !== "instagram.com") return null;
    const first = segs(u)[0]?.toLowerCase().replace(/^@/, "");
    if (!first || IG_RESERVED.has(first) || !/^[a-z0-9._]{1,30}$/.test(first)) return null;
    return first;
  },
  indexPhrases: (h) => [`"instagram.com/${h}"`],
  resultBelongsToHandle(r, handle) {
    const h = handle.toLowerCase(); const u = urlOf(r.url); if (!u || host(u) !== "instagram.com") return false;
    if (segs(u)[0]?.toLowerCase() === h) return true;
    const text = `${r.title ?? ""}\n${r.description ?? ""}`;
    return new RegExp(`more posts from ${esc(h)}\\b`, "i").test(text) || new RegExp(`^${esc(h)} on instagram`, "i").test((r.title ?? "").trim());
  },
  parseIndexTitle(title, description) {
    const m = (title ?? "").match(/^(.+?) on Instagram:\s*"?([\s\S]*?)"?\s*$/i);
    const name = m?.[1]?.trim() ?? null;
    const text = (m?.[2] ?? description ?? "").replace(/\s+/g, " ").replace(/\b(Like|Reply|Follow|Log in to like or comment\.|More posts from \S+)\b/g, " ").replace(/\s+/g, " ").trim() || null;
    return { displayName: name && name.toLowerCase() !== "instagram" ? name : null, text };
  },
  extractProfile() { return null; }, // verified: nothing renders without a session
};

// ---------------- TikTok ----------------
const TT_RESERVED = new Set(["login", "discover", "music", "tag", "about", "legal", "business", "foryou", "upload", "embed", "explore", "live", "search", "trending", "privacy", "terms", "safety", "creators", "ads"]);
export const tiktokAdapter: SocialAdapter = {
  platform: "tiktok",
  indexDomains: ["tiktok.com"],
  handleFromUrl(url) {
    const u = urlOf(url); if (!u || host(u) !== "tiktok.com") return null;
    const first = segs(u)[0]; if (!first) return null;
    if (!first.startsWith("@")) return null;
    const h = first.slice(1).toLowerCase();
    if (!h || TT_RESERVED.has(h) || !/^[a-z0-9._]{1,30}$/.test(h)) return null;
    return h;
  },
  indexPhrases: (h) => [`"tiktok.com/@${h}"`],
  resultBelongsToHandle(r, handle) {
    const h = handle.toLowerCase(); const u = urlOf(r.url); if (!u || host(u) !== "tiktok.com") return false;
    if (segs(u)[0]?.toLowerCase() === `@${h}`) return true;
    return new RegExp(`\\(@${esc(h)}\\)`, "i").test(r.title ?? "");
  },
  parseIndexTitle(title, description) {
    const m = (title ?? "").match(/^(.+?)\s*\(@[\w.]+\)\s*(?:on TikTok)?[:|]?\s*([\s\S]*?)(?:\|\s*TikTok)?\s*$/i);
    return { displayName: m?.[1]?.trim() ?? null, text: (m?.[2] ?? description ?? "").replace(/\s+/g, " ").trim() || null };
  },
  extractProfile(page) {
    const m = page.html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application\/json">([\s\S]*?)<\/script>/);
    if (!m) return null;
    try {
      const d = JSON.parse(m[1]);
      const ud = d?.__DEFAULT_SCOPE__?.["webapp.user-detail"];
      const user = ud?.userInfo?.user;
      if (!user?.uniqueId) return null;
      const bio = typeof user.signature === "string" ? user.signature.trim() || null : null;
      const link = user.bioLink?.link ? String(user.bioLink.link) : null;
      const website = link ? (/^https?:\/\//i.test(link) ? link : `https://${link}`) : null;
      return {
        platform: "tiktok", handle: String(user.uniqueId).toLowerCase(), displayName: user.nickname ? String(user.nickname) : null, bio, headline: null,
        website, links: website ? [website] : [], location: user.region ? String(user.region) : null, category: null,
        flags: { business: !!user.commerceUserInfo?.commerceUser || user.isOrganization === 1 || user.isOrganization === true, verified: !!user.verified, organization: user.isOrganization === 1 || user.isOrganization === true, seller: !!user.ttSeller, private: !!user.privateAccount },
        urlKind: null,
      };
    } catch { return null; }
  },
};

// ---------------- X ----------------
const X_RESERVED = new Set(["home", "explore", "search", "settings", "i", "intent", "share", "login", "signup", "tos", "privacy", "about", "help", "hashtag", "notifications", "messages", "compose", "download"]);
export const xAdapter: SocialAdapter = {
  platform: "x",
  indexDomains: ["x.com", "twitter.com"],
  handleFromUrl(url) {
    const u = urlOf(url); if (!u) return null; const hst = host(u);
    if (hst !== "x.com" && hst !== "twitter.com") return null;
    const first = segs(u)[0]?.replace(/^@/, "").toLowerCase();
    if (!first || X_RESERVED.has(first) || !/^[a-z0-9_]{1,15}$/.test(first)) return null;
    return first;
  },
  indexPhrases: (h) => [`"x.com/${h}"`, `"twitter.com/${h}"`],
  resultBelongsToHandle(r, handle) {
    const h = handle.toLowerCase(); const u = urlOf(r.url); if (!u) return false; const hst = host(u);
    if (hst !== "x.com" && hst !== "twitter.com") return false;
    if (segs(u)[0]?.replace(/^@/, "").toLowerCase() === h) return true;
    return new RegExp(`\\(@${esc(h)}\\)`, "i").test(r.title ?? "");
  },
  parseIndexTitle(title, description) {
    const m = (title ?? "").match(/^(.+?)\s*\(@[\w]+\)\s*(?:on X|\/ X)?:?\s*([\s\S]*?)$/i);
    return { displayName: m?.[1]?.trim() ?? null, text: (m?.[2] ?? description ?? "").replace(/\s+/g, " ").trim() || null };
  },
  extractProfile(page) {
    const ogTitle = meta(page, "og:title") ?? (extractTitle(page.html) ? decodeEntities(extractTitle(page.html)!) : null);
    const m = ogTitle?.match(/^(.+?)\s*\(@([\w]+)\)\s*(?:on X|\/ X)?\s*$/i);
    if (!m) return null;
    const bio = meta(page, "og:description") ?? meta(page, "description");
    return { platform: "x", handle: m[2].toLowerCase(), displayName: m[1].trim(), bio, headline: null, website: null, links: [], location: null, category: null, flags: {}, urlKind: null };
  },
};

// ---------------- LinkedIn ----------------
export const linkedinAdapter: SocialAdapter = {
  platform: "linkedin",
  indexDomains: ["linkedin.com"],
  handleFromUrl(url) {
    const u = urlOf(url); if (!u || host(u) !== "linkedin.com" && !host(u).endsWith(".linkedin.com")) return null;
    const s = segs(u); const kind = s[0]?.toLowerCase(); const slug = s[1]?.toLowerCase().replace(/\/+$/, "");
    if (!kind || !slug) return null;
    if (!["company", "in", "school", "showcase"].includes(kind)) return null;
    return `${kind}/${slug}`;
  },
  indexPhrases: (h) => [`"linkedin.com/${h}"`],
  resultBelongsToHandle(r, handle) {
    const u = urlOf(r.url); if (!u || !host(u).endsWith("linkedin.com")) return false;
    const s = segs(u); const mine = `${s[0]?.toLowerCase()}/${s[1]?.toLowerCase()}`;
    // Exact slug only. The index returned linkedin.com/in/scudamore for the
    // query "linkedin.com/in/brianscudamore" -- same person, but we cannot
    // know that, so it is NOT this account.
    return mine === handle.toLowerCase();
  },
  parseIndexTitle(title, description) {
    // "Brian Scudamore - Founder & CEO - 1-800-GOT-JUNK? | LinkedIn" or just "Brian Scudamore"
    const clean = (title ?? "").replace(/\s*\|\s*LinkedIn\s*$/i, "").trim();
    const parts = clean.split(/\s+-\s+/);
    return { displayName: parts[0]?.trim() || null, text: [parts.slice(1).join(" - "), description ?? ""].filter(Boolean).join(" | ").replace(/\s+/g, " ").trim() || null };
  },
  extractProfile(page) {
    const u = urlOf(page.finalUrl); const kind = u ? segs(u)[0]?.toLowerCase() : null;
    const ogTitle = meta(page, "og:title");
    if (!ogTitle || !/\|\s*LinkedIn$/i.test(ogTitle)) return null;
    const name = ogTitle.replace(/\s*\|\s*LinkedIn\s*$/i, "").trim();
    if (!name || /^linkedin$|sign up|log in/i.test(name)) return null;
    const desc = meta(page, "description") ?? meta(page, "og:description");
    // "Name | 16,542 followers on LinkedIn. <tagline> | <about...>"
    const about = desc ? desc.replace(/^.*?followers on LinkedIn\.\s*/i, "").trim() : null;
    const field = (f: string) => { const mm = page.html.match(new RegExp(`data-test-id="about-us__${f}"[\\s\\S]{0,400}?<dd[^>]*>\\s*(?:<a[^>]*>)?\\s*([^<]{1,300})`)); return mm ? decodeEntities(mm[1]).trim() || null : null; };
    const website = field("website");
    const specialties = field("specialties")?.split(/,\s*/).map((x) => x.trim()).filter(Boolean) ?? [];
    return {
      platform: "linkedin", handle: this.handleFromUrl(page.finalUrl), displayName: name, bio: about, headline: null, website, links: website ? [website] : [],
      location: field("headquarters"), category: field("industry"),
      flags: { organization: kind === "company" || kind === "school" || kind === "showcase", business: kind === "company" || kind === "showcase" },
      companyFacts: { industry: field("industry"), size: field("size"), headquarters: field("headquarters"), founded: field("founded"), specialties, website },
      urlKind: kind ?? null,
    };
  },
};

// ---------------- Facebook (index + handle only; fetching has its own path) ----------------
const FB_NON_HANDLE = new Set(["profile.php", "pages", "people", "share", "groups", "events", "login", "watch", "marketplace", "reel", "reels", "stories", "photo.php", "help"]);
export const facebookAdapter: SocialAdapter = {
  platform: "facebook",
  indexDomains: ["facebook.com"],
  handleFromUrl(url) {
    const u = urlOf(url); if (!u || host(u) !== "facebook.com") return null;
    const s = segs(u); const first = s[0]?.toLowerCase();
    if (!first) return null;
    if (first === "profile.php") { const id = u.searchParams.get("id"); return id ? `profile.php?id=${id}` : null; }
    if ((first === "pages" || first === "people") && s[2]) return `${first}/${s[1].toLowerCase()}/${s[2]}`;
    if (FB_NON_HANDLE.has(first)) return null;
    return first;
  },
  indexPhrases: (h) => [`"facebook.com/${h}"`],
  resultBelongsToHandle(r, handle) {
    const u = urlOf(r.url); if (!u || host(u) !== "facebook.com") return false;
    return facebookAdapter.handleFromUrl(r.url) === handle.toLowerCase();
  },
  parseIndexTitle(title, description) { return { displayName: (title ?? "").replace(/\s*[|-]\s*Facebook\s*$/i, "").trim() || null, text: description }; },
  extractProfile() { return null; },
};

export const SOCIAL_ADAPTERS: SocialAdapter[] = [instagramAdapter, tiktokAdapter, xAdapter, linkedinAdapter, facebookAdapter];

export function adapterForUrl(url: string): SocialAdapter | null {
  for (const a of SOCIAL_ADAPTERS) if (a.handleFromUrl(url)) return a;
  return null;
}
export function adapterForPlatform(platform: string): SocialAdapter | null {
  return SOCIAL_ADAPTERS.find((a) => a.platform === platform) ?? null;
}
export { canonicalDomain };
