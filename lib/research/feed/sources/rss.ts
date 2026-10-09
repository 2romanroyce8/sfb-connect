import type { FeedSource, FeedTarget, RawFinding, RssFeed } from "../types";

/**
 * RSS / Atom as a prospect source. Industry and local-business news feeds
 * mention companies that just won a contract, opened a branch, or got
 * covered — timely outreach triggers.
 *
 * Honesty rule: an item becomes a finding ONLY if its text names the target
 * city (and the state or the vertical). A roofing article about Houston is
 * not a Tampa prospect. Yield is low and precise by design; business names
 * are extracted from prose and labelled "unverified" downstream.
 *
 * No XML dependency: a small, tolerant parser for RSS 2.0 <item> and Atom
 * <entry>. It reads only the handful of fields we use.
 */
export type FeedItem = { title: string; link: string | null; summary: string; publishedAt: string | null };

const entity = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
const stripHtml = (s: string) => entity(entity(s).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const tag = (block: string, name: string): string | null => {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"));
  return m ? m[1] : null;
};
const atomLink = (block: string): string | null => {
  const alt = block.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i) ?? block.match(/<link[^>]*href=["']([^"']+)["'][^>]*>/i);
  return alt ? entity(alt[1]) : null;
};
const isoDate = (raw: string | null): string | null => {
  if (!raw) return null;
  const d = new Date(stripHtml(raw));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

export function parseFeed(xml: string): FeedItem[] {
  const items: FeedItem[] = [];
  const blocks = [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi), ...xml.matchAll(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi)];
  for (const m of blocks) {
    const b = m[1];
    const title = stripHtml(tag(b, "title") ?? "");
    if (!title) continue;
    const rssLink = tag(b, "link");
    const link = rssLink && stripHtml(rssLink) ? stripHtml(rssLink) : atomLink(b);
    const summary = stripHtml(tag(b, "description") ?? tag(b, "summary") ?? tag(b, "content:encoded") ?? tag(b, "content") ?? "");
    const publishedAt = isoDate(tag(b, "pubDate") ?? tag(b, "published") ?? tag(b, "updated") ?? tag(b, "dc:date"));
    items.push({ title, link, summary: summary.slice(0, 1200), publishedAt });
  }
  return items;
}

/** Item ↔ target relevance: must name the city, plus the state or the vertical. */
export function itemMatchesTarget(item: FeedItem, target: FeedTarget): boolean {
  const text = `${item.title} ${item.summary}`;
  const city = new RegExp(`\\b${escapeRe(target.city)}\\b`, "i");
  if (!city.test(text)) return false;
  const state = new RegExp(`\\b(${escapeRe(target.state)}|${escapeRe(stateName(target.state))})\\b`, "i");
  const vertical = new RegExp(`\\b${escapeRe(verticalStem(target.vertical))}`, "i");
  return state.test(text) || vertical.test(text);
}
/** "roofing" → "roof" so roofer / roofers / roofs all count. */
export const verticalStem = (v: string) => v.toLowerCase().replace(/(ing|ers?|s)$/, "") || v.toLowerCase();
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function rssFeedSource(feeds: RssFeed[], opts: { fetchImpl?: typeof fetch; maxAgeDays?: number } = {}): FeedSource {
  const f = opts.fetchImpl ?? fetch;
  const maxAgeMs = (opts.maxAgeDays ?? 14) * 86_400_000;
  const cache = new Map<string, Promise<FeedItem[]>>(); // one fetch per feed per run, shared across targets
  const load = (feed: RssFeed, signal?: AbortSignal) => {
    if (!cache.has(feed.url)) {
      cache.set(
        feed.url,
        (async () => {
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 10_000);
          const onAbort = () => ctrl.abort();
          signal?.addEventListener("abort", onAbort, { once: true });
          try {
            const res = await f(feed.url, { headers: { "user-agent": "Mozilla/5.0 (compatible; SFBConnectFeed/1.0; +https://www.sfbconnect.com)", accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" }, signal: ctrl.signal });
            if (!res.ok) return [];
            return parseFeed(await res.text());
          } catch {
            return [];
          } finally {
            clearTimeout(timer);
            signal?.removeEventListener("abort", onAbort);
          }
        })(),
      );
    }
    return cache.get(feed.url)!;
  };
  return {
    kind: "rss",
    isConfigured: () => feeds.some((x) => x.active),
    async pull(target, { limit, signal }) {
      const out: RawFinding[] = [];
      const now = Date.now();
      for (const feed of feeds.filter((x) => x.active)) {
        for (const item of await load(feed, signal)) {
          if (item.publishedAt && now - new Date(item.publishedAt).getTime() > maxAgeMs) continue;
          if (!itemMatchesTarget(item, target)) continue;
          out.push({ sourceKind: "rss", sourceUrl: item.link ?? feed.url, title: item.title, snippet: item.summary, url: null, publishedAt: item.publishedAt, targetId: target.id });
          if (out.length >= limit) return out;
        }
      }
      return out;
    },
  };
}

const STATE_NAMES: Record<string, string> = { AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming" };
export const stateName = (code: string) => STATE_NAMES[code.toUpperCase()] ?? code;
export const US_STATE_CODES = Object.keys(STATE_NAMES);
/** Accepts "FL", "fl", "Florida" → "FL"; anything else → null. */
export const normalizeState = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  const s = raw.trim();
  if (/^[A-Za-z]{2}$/.test(s) && STATE_NAMES[s.toUpperCase()]) return s.toUpperCase();
  const hit = Object.entries(STATE_NAMES).find(([, n]) => n.toLowerCase() === s.toLowerCase());
  return hit ? hit[0] : null;
};
