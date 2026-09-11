// Crawl-frontier priority + budget for the website sub-page discovery step.
// Fixing pageKey() (see normalize.ts) makes the Discovery Graph actually
// crawl every meaningful page on a site instead of silently stopping after
// the first one -- but that alone can flip the failure mode from "1 page
// crawled" to "1 site explodes into hundreds of low-value URLs" (paginated
// blogs, one page per city/team-member, tracking variants, etc). This module
// is the other half of that fix: score candidate pages by how much a
// salesperson would actually care about them, and cap how many pages from
// one domain the graph will ever fetch.

export const MAX_PAGES_PER_DOMAIN = 15;

// Order matters only in that every rule is checked and the HIGHEST matching
// score wins (so "/services/contact-us" scores as contact, not services) --
// these are deliberately substring/regex matches against the full path,
// not exact-slug equality, since real sites vary (/contact, /contact-us,
// /get-in-touch-with-us all mean the same thing to a salesperson).
const PAGE_PRIORITY_RULES: { pattern: RegExp; score: number }[] = [
  { pattern: /wp-admin|wp-login|\/login\b|\/signin\b|\/cart\b|\/checkout\b/i, score: -100 },
  { pattern: /\/privacy|\/terms/i, score: -100 },
  { pattern: /\/tag\/|\/author\/|[?&]page=/i, score: -80 },
  { pattern: /\/contact/i, score: 100 },
  { pattern: /\/about/i, score: 90 },
  { pattern: /\/services?\b/i, score: 90 },
  { pattern: /\/service-area|\/areas?-we-serve|\/locations?\b/i, score: 85 },
  { pattern: /\/pricing/i, score: 80 },
  { pattern: /\/book(ing)?\b/i, score: 80 },
  { pattern: /\/faq/i, score: 70 },
  { pattern: /\/team\b/i, score: 60 },
  { pattern: /\/gallery|\/portfolio/i, score: 25 },
  { pattern: /\/blog/i, score: 15 },
];

// Never worth queuing at all, independent of budget: admin/auth/commerce
// surfaces, legal boilerplate, paginated archive/tag/author listings,
// calendar archives, and non-HTML assets (images/docs) unless explicitly
// wanted later. A URL that hits this returns true and must never be
// enqueued, even if the domain budget has room.
const REJECT_PATTERNS: RegExp[] = [
  /wp-admin|wp-login/i,
  /\/login\b|\/signin\b|\/sign-in\b/i,
  /\/cart\b|\/checkout\b/i,
  /\/privacy|\/terms/i,
  /\/tag\/|\/author\//i,
  /[?&]page=\d/i,
  /\/calendar\/\d{4}/i, // dated calendar archive pages, not the booking widget itself
];
const REJECT_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp", ".zip", ".css", ".js", ".woff", ".woff2", ".mp4"];

export function isRejectedPath(url: string): boolean {
  let path = "";
  try {
    path = new URL(url).pathname.toLowerCase();
  } catch {
    return false; // unparseable -- let normal handling deal with it, not this filter
  }
  if (REJECT_EXTENSIONS.some((ext) => path.endsWith(ext))) return true;
  return REJECT_PATTERNS.some((p) => p.test(url));
}

/** Higher = more valuable to a salesperson. Unmatched paths (e.g. the
 * homepage itself, or a generic page not in any rule) get a neutral 10 so
 * they're still crawled if budget allows, just after anything recognizable. */
export function scorePagePriority(url: string): number {
  let path = "";
  try {
    const u = new URL(url);
    path = u.pathname;
  } catch {
    path = url;
  }
  let best = 10;
  for (const rule of PAGE_PRIORITY_RULES) {
    if (rule.pattern.test(path) || rule.pattern.test(url)) best = Math.max(best, rule.score);
  }
  return best;
}

/** Pure, directly testable: given every candidate URL discovered on a
 * domain, return them ordered highest-priority first with rejects removed.
 * The CALLER is responsible for stopping once the remaining per-domain
 * budget is used up -- this function doesn't know how many pages from that
 * domain are already queued/visited. */
export function sortByPriority(urls: string[]): string[] {
  return urls
    .filter((u) => !isRejectedPath(u))
    .map((u) => ({ url: u, score: scorePagePriority(u) }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.url);
}
