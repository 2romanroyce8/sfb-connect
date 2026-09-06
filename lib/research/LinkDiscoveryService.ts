import type { FetchedPage } from "./types";
import { extractLinks, findLocalBusiness, extractJsonLd } from "./htmlExtract";
import { classifyLink, canonicalDomain, isSocialOrDirectoryHost } from "./normalize";

export type DiscoveredLinks = {
  officialWebsite: string | null;
  socials: { platform: string; url: string }[];
  bookingLinks: string[];
  linkInBioPages: string[];
};

// Follows the "the seed is a starting point" rule: pulls every outbound link
// off a fetched page and sorts it into official-site / social / booking /
// link-in-bio buckets. Never invents a link that wasn't actually in the HTML.
export function discoverLinks(page: FetchedPage): DiscoveredLinks {
  if (!page.ok) return { officialWebsite: null, socials: [], bookingLinks: [], linkInBioPages: [] };

  const links = extractLinks(page.html, page.finalUrl);
  const socials: { platform: string; url: string }[] = [];
  const bookingLinks: string[] = [];
  const linkInBioPages: string[] = [];
  const candidateWebsites = new Map<string, number>(); // domain -> occurrence count

  const selfDomain = canonicalDomain(page.finalUrl);

  for (const link of links) {
    const domain = canonicalDomain(link);
    if (!domain || domain === selfDomain) continue;
    const cls = classifyLink(link);
    if (cls.kind === "social") {
      if (!socials.some((s) => s.platform === cls.platform && canonicalDomain(s.url) === domain)) {
        socials.push({ platform: cls.platform, url: link });
      }
      continue;
    }
    if (cls.kind === "whatsapp") continue; // handled by ContactDiscoveryService
    if (cls.kind === "booking") {
      bookingLinks.push(link);
      continue;
    }
    if (cls.kind === "linktree") {
      linkInBioPages.push(link);
      continue;
    }
    if (!isSocialOrDirectoryHost(link)) {
      candidateWebsites.set(domain, (candidateWebsites.get(domain) || 0) + 1);
    }
  }

  // JSON-LD `url` field, when present, is a much stronger signal of the
  // official site than a link-count heuristic.
  const localBusiness = findLocalBusiness(extractJsonLd(page.html));
  const jsonLdUrl = localBusiness?.url ? String(localBusiness.url) : null;

  let officialWebsite: string | null = jsonLdUrl;
  if (!officialWebsite && candidateWebsites.size > 0) {
    officialWebsite = [...candidateWebsites.entries()].sort((a, b) => b[1] - a[1])[0][0];
    officialWebsite = `https://${officialWebsite}`;
  }
  // If the seed page IS itself a real business website (not a social page),
  // that's the official site — no discovery needed.
  if (page.sourceType === "website") officialWebsite = page.finalUrl;

  return { officialWebsite, socials, bookingLinks, linkInBioPages };
}
