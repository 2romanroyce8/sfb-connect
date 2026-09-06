import type { FetchedPage } from "./types";
import { fetchPage } from "./fetchSource";
import { extractLinks } from "./htmlExtract";
import { canonicalDomain } from "./normalize";

const PRIORITY_SLUGS = ["about", "contact", "services", "products", "locations", "service-area", "areas-we-serve", "faq", "booking", "team"];
const MAX_PAGES = 6;

// Crawls the official website beyond the homepage, following only links that
// stay on the same domain and match a small set of business-relevant page
// types. This is a shallow, bounded crawl (max 6 pages) — enough to find
// contact/location/social info without turning into an open-ended spider.
export async function crawlWebsite(homepageUrl: string): Promise<FetchedPage[]> {
  const home = await fetchPage(homepageUrl);
  if (!home.ok) return [home];

  const domain = canonicalDomain(home.finalUrl);
  const links = extractLinks(home.html, home.finalUrl);
  const priorityLinks = links.filter((l) => {
    if (canonicalDomain(l) !== domain) return false;
    const path = (() => {
      try {
        return new URL(l).pathname.toLowerCase();
      } catch {
        return "";
      }
    })();
    return PRIORITY_SLUGS.some((slug) => path.includes(slug));
  });

  const uniquePriority = Array.from(new Set(priorityLinks)).slice(0, MAX_PAGES - 1);
  const pages: FetchedPage[] = [home];
  for (const link of uniquePriority) {
    const page = await fetchPage(link);
    pages.push(page);
  }
  return pages;
}
