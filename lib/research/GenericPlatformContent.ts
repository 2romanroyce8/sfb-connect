// A social platform's own generic shell content (its bare homepage, a
// login wall, an "accounts/create" page) describes the PLATFORM, never the
// business being researched -- but our fetcher can't execute JS, so a
// blocked or login-walled profile page (Instagram in particular, a
// client-rendered SPA) often returns HTTP 200 with this exact generic
// content instead of a 4xx, even though the REQUESTED url had a specific
// handle in its path. If that generic content is allowed to seed
// name/category candidates or outbound-link discovery (official website /
// socials), a blocked profile can silently be replaced by the PLATFORM's
// own identity.
//
// This is the confirmed root cause behind two real production incidents:
// (1) an Instagram login-wall page's generic title/description ("Create an
//     account or log in to Instagram") became this business's "name", and
// (2) that one-word generic name ("Instagram") then trivially
//     word-overlap-matched a completely unrelated page (Apify's own
//     "Instagram Scraper" marketing page), which was accepted as the
//     business's real website via meta.ai / apify.com.
import type { FetchedPage } from "./types";
import { extractTitle, extractMeta } from "./htmlExtract";
import { isReservedSocialRoute } from "./normalize";

const KNOWN_PLATFORM_SOURCE_TYPES = new Set(["facebook", "instagram", "tiktok", "youtube", "x", "linkedin"]);

const GENERIC_PLATFORM_TEXT: Record<string, RegExp> = {
  facebook: /^facebook$|log\s*in.*facebook|welcome to facebook/i,
  instagram: /^instagram$|log\s*in.*instagram|create an account or log in to instagram/i,
  tiktok: /^tiktok$|log\s*in.*tiktok/i,
  youtube: /^youtube$/i,
  x: /^x$|^twitter$|log\s*in.*(x corp|twitter)/i,
  linkedin: /^linkedin$|sign\s*up.*linkedin|log\s*in.*linkedin/i,
};

/** True when a fetched page's content is a social platform's own generic
 * shell/boilerplate rather than anything specific to the business the URL
 * was supposed to identify. Such a page should never contribute
 * name/category/description candidates, and its outbound links should
 * never seed official-website or social-profile discovery -- it's
 * platform navigation chrome, not evidence about the business. */
export function isGenericPlatformContent(page: FetchedPage): boolean {
  if (!KNOWN_PLATFORM_SOURCE_TYPES.has(page.sourceType)) return false;

  // A bare platform root (no path segments at all) has no profile in it to
  // begin with -- always generic, regardless of title.
  try {
    const segments = new URL(page.finalUrl).pathname.split("/").filter(Boolean);
    if (segments.length === 0) return true;
  } catch {
    // unparseable finalUrl -- fall through to the title/description check
  }

  // Reuses classifyLink's own reserved-route list -- a reserved-route page
  // that reached here anyway (e.g. because a redirect changed the URL
  // after classifyLink() already approved the original link) is still the
  // platform's own feature page, not the business. Confirmed necessary in
  // production: Instagram's /popular/ "suggested accounts" placeholder had
  // no title text matching the generic-title patterns below, but IS a
  // known reserved Instagram route.
  if (isReservedSocialRoute(page.finalUrl, page.sourceType)) return true;

  const pattern = GENERIC_PLATFORM_TEXT[page.sourceType];
  if (!pattern) return false;
  const title = (extractTitle(page.html) || "").trim();
  const ogTitle = (extractMeta(page.html, "og:title") || "").trim();
  const description = (extractMeta(page.html, "description") || extractMeta(page.html, "og:description") || "").trim();
  return pattern.test(title) || pattern.test(ogTitle) || pattern.test(description);
}
