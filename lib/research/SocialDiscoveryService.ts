import type { FetchedPage, SocialProfileRecord, SocialPlatform } from "./types";
import { extractJsonLd, findLocalBusiness } from "./htmlExtract";
import { discoverLinks } from "./LinkDiscoveryService";
import { socialPlatformFor } from "./normalize";
import { normalizeSocialProfileUrl } from "./SocialProfileNormalizer";

// A handle linked directly FROM the business's own official website gets
// meaningfully higher confidence than one merely mentioned somewhere else —
// this is the "official site link = strong signal" rule from the spec.
export function discoverSocialProfiles(pages: FetchedPage[]): SocialProfileRecord[] {
  const byPlatform = new Map<SocialPlatform, SocialProfileRecord>();

  // Every stored social profile goes through the ONE central normalizer --
  // this is what guarantees a stored record is always
  // https://facebook.com/{handle}, never a raw m./mbasic./www. variant and
  // never a platform help/login/reserved-route URL that slipped past
  // upstream classification. WhatsApp isn't a profile URL in this sense
  // (ContactDiscoveryService owns it) so it's stored as-is.
  function add(platform: SocialPlatform, url: string, sourceUrl: string, strength: "official" | "secondary") {
    let canonicalUrl = url;
    let handle: string | null = null;
    if (platform === "whatsapp") {
      handle = null;
    } else {
      const identity = normalizeSocialProfileUrl(url);
      if (!identity.valid || !identity.canonicalUrl) return; // fail closed -- never store an unresolved/reserved-route "profile"
      canonicalUrl = identity.canonicalUrl;
      handle = identity.handle;
    }
    const existing = byPlatform.get(platform);
    const confidence = strength === "official" ? 0.9 : 0.55;
    if (!existing || confidence > existing.confidence) {
      byPlatform.set(platform, {
        platform,
        handle,
        url: canonicalUrl,
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
