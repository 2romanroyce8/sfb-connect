import type { FetchedPage, SocialProfileRecord, SocialPlatform } from "./types";
import { extractJsonLd, findLocalBusiness } from "./htmlExtract";
import { discoverLinks } from "./LinkDiscoveryService";
import { socialPlatformFor } from "./normalize";

function handleFromUrl(url: string, platform: SocialPlatform): string | null {
  try {
    const path = new URL(url).pathname.replace(/^\/+|\/+$/g, "");
    return path.split("/")[0] || null;
  } catch {
    return null;
  }
}

// A handle linked directly FROM the business's own official website gets
// meaningfully higher confidence than one merely mentioned somewhere else —
// this is the "official site link = strong signal" rule from the spec.
export function discoverSocialProfiles(pages: FetchedPage[]): SocialProfileRecord[] {
  const byPlatform = new Map<SocialPlatform, SocialProfileRecord>();

  function add(platform: SocialPlatform, url: string, sourceUrl: string, strength: "official" | "secondary") {
    const existing = byPlatform.get(platform);
    const confidence = strength === "official" ? 0.9 : 0.55;
    if (!existing || confidence > existing.confidence) {
      byPlatform.set(platform, {
        platform,
        handle: handleFromUrl(url, platform),
        url,
        displayName: null,
        status: strength === "official" ? "verified" : "uncertain",
        confidence,
        sourceUrl,
      });
    }
  }

  for (const page of pages) {
    if (!page.ok) continue;
    const isOfficialSite = page.sourceType === "website";

    const { socials } = discoverLinks(page);
    for (const s of socials) {
      add(s.platform as SocialPlatform, s.url, page.finalUrl, isOfficialSite ? "official" : "secondary");
    }

    const localBusiness = findLocalBusiness(extractJsonLd(page.html));
    const sameAs = localBusiness?.sameAs;
    if (sameAs) {
      const list = Array.isArray(sameAs) ? sameAs : [sameAs];
      for (const url of list) {
        const platform = socialPlatformFor(String(url));
        if (platform) add(platform, String(url), page.finalUrl, "official");
      }
    }
  }

  return Array.from(byPlatform.values());
}
