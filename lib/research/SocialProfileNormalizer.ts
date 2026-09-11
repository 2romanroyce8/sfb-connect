// ============================================================
// SFB Sales OS — Centralized Social Profile URL Normalizer
//
// A social profile URL carries THREE separate concepts that must never be
// merged into one string:
//   DOMAIN            facebook.com               (canonicalDomain/domainKey)
//   PLATFORM          "facebook"                 (which social network)
//   PROFILE IDENTITY  facebook.com/tonytints925   (the actual business)
// ...plus a fourth, purely informational one that must NEVER be allowed
// anywhere inside a canonical URL: the platform's corporate OWNER (Meta,
// Google, ByteDance). Concatenating owner metadata onto a hostname (or
// letting the platform's own corporate site win "official website" through
// an unfiltered link chain) is exactly the class of bug this module exists
// to prevent -- see normalize.ts's PLATFORM_OWNER_EXACT_HOSTS /
// RESERVED_SOCIAL_ROUTES for the companion fix that stops a platform's own
// help/login/about pages from ever being crawled as if they were the
// submitted business in the first place.
//
// This is the SINGLE authoritative place that turns a raw social URL into
// a canonical profile identity. LeadProfileBuilder, ResearchQA,
// SocialDiscoveryService, LinkDiscoveryService, and any future Autonomous
// Scout candidate ingestion must all go through this function rather than
// inventing their own hostname/handle parsing -- that duplication is what
// let this class of bug exist in more than one place at once (the same
// mistake pageKey()/domainKey() fixed for website crawling).
// ============================================================
import { normalizeUrl } from "./normalize";

export type SocialPlatformId = "facebook" | "instagram" | "tiktok" | "youtube" | "x" | "linkedin";

export type SocialProfileIdentity = {
  originalUrl: string;
  canonicalUrl: string | null;
  platform: SocialPlatformId | null;
  // Purely informational (e.g. "Meta", "Google", "ByteDance") -- NEVER part
  // of canonicalUrl or hostname. This field existing is what makes it safe
  // to carry the fact around without it leaking into a URL.
  platformOwner: string | null;
  hostname: string | null;
  handle: string | null;
  profileType: string | null;
  valid: boolean;
  rejectionReason: string | null;
};

const CANONICAL_HOST: Record<SocialPlatformId, string> = {
  facebook: "facebook.com",
  instagram: "instagram.com",
  tiktok: "tiktok.com",
  youtube: "youtube.com",
  x: "x.com",
  linkedin: "linkedin.com",
};

const PLATFORM_OWNER: Record<SocialPlatformId, string> = {
  facebook: "Meta",
  instagram: "Meta",
  tiktok: "ByteDance",
  youtube: "Google",
  x: "X Corp",
  linkedin: "Microsoft",
};

// Every real hostname alias a legitimate profile URL can arrive on,
// including the mbasic/m. mobile-lite Facebook surfaces fetchSource.ts's
// mbasic fallback actually fetches -- all of them must resolve to the SAME
// platform + canonical host, never a distinct one.
const HOST_PLATFORM: Record<string, SocialPlatformId> = {
  "facebook.com": "facebook",
  "fb.com": "facebook",
  "m.facebook.com": "facebook",
  "mbasic.facebook.com": "facebook",
  "instagram.com": "instagram",
  "tiktok.com": "tiktok",
  "m.tiktok.com": "tiktok",
  "youtube.com": "youtube",
  "youtu.be": "youtube",
  "x.com": "x",
  "twitter.com": "x",
  "mobile.twitter.com": "x",
  "linkedin.com": "linkedin",
};

// Same reserved-route lists as normalize.ts's classifyLink() -- duplicated
// deliberately narrow (this module doesn't import classifyLink to avoid a
// circular dependency, since normalize.ts is the lower-level primitive).
// If either list changes, both need the same update.
const RESERVED_ROUTES: Record<SocialPlatformId, Set<string>> = {
  facebook: new Set(["login", "login.php", "share", "sharer", "watch", "marketplace", "groups", "events", "help", "privacy", "policies", "settings", "ads", "business", "developers", "plugins", "dialog", "l.php", "tr", "photo.php", "video.php", "home.php", "about", "legal"]),
  instagram: new Set(["explore", "accounts", "direct", "reels", "reel", "stories", "p", "about", "developer", "legal", "tv", "embed", "graphql"]),
  tiktok: new Set(["login", "discover", "music", "tag", "about", "legal", "business", "foryou", "upload", "embed"]),
  youtube: new Set(["watch", "results", "playlist", "feed", "shorts", "about", "account", "upload", "gaming", "premium", "live", "embed", "redirect"]),
  x: new Set(["home", "explore", "notifications", "messages", "settings", "search", "i", "intent", "hashtag", "login", "tos", "privacy", "about", "jobs"]),
  linkedin: new Set(["help", "legal", "login", "signup", "about", "jobs", "learning"]),
};

function detectPlatform(hostname: string): SocialPlatformId | null {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  return HOST_PLATFORM[host] ?? null;
}

function invalid(originalUrl: string, platform: SocialPlatformId | null, hostname: string | null, reason: string): SocialProfileIdentity {
  return {
    originalUrl,
    canonicalUrl: null,
    platform,
    platformOwner: platform ? PLATFORM_OWNER[platform] : null,
    hostname,
    handle: null,
    profileType: null,
    valid: false,
    rejectionReason: reason,
  };
}

/** The single authoritative social-profile parser. Never invents a URL --
 * on any uncertainty this fails closed with valid:false and a specific
 * rejectionReason rather than guessing. */
export function normalizeSocialProfileUrl(input: string): SocialProfileIdentity {
  const originalUrl = input;
  let u: URL;
  try {
    const withScheme = /^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`;
    u = new URL(normalizeUrl(withScheme));
  } catch {
    return invalid(originalUrl, null, null, "INVALID_SOCIAL_PROFILE_URL");
  }

  const hostnameRaw = u.hostname.toLowerCase();
  const platform = detectPlatform(hostnameRaw);
  if (!platform) return invalid(originalUrl, null, hostnameRaw, "NOT_A_SOCIAL_HOST");

  const canonicalHost = CANONICAL_HOST[platform];
  const platformOwner = PLATFORM_OWNER[platform];
  const segments = u.pathname.split("/").filter(Boolean);
  const first = segments[0] ?? null;
  const firstLower = first?.toLowerCase() ?? null;

  if (firstLower && RESERVED_ROUTES[platform].has(firstLower)) {
    return invalid(originalUrl, platform, canonicalHost, "RESERVED_PLATFORM_ROUTE");
  }

  const ok = (canonicalUrl: string, handle: string | null, profileType: string): SocialProfileIdentity => ({
    originalUrl,
    canonicalUrl,
    platform,
    platformOwner,
    hostname: canonicalHost,
    handle,
    profileType,
    valid: true,
    rejectionReason: null,
  });

  switch (platform) {
    case "facebook": {
      if (!first) return invalid(originalUrl, platform, canonicalHost, "SOCIAL_PROFILE_IDENTITY_UNRESOLVED");
      if (firstLower === "profile.php") {
        const id = u.searchParams.get("id");
        if (!id) return invalid(originalUrl, platform, canonicalHost, "SOCIAL_PROFILE_IDENTITY_UNRESOLVED");
        return ok(`https://${canonicalHost}/profile.php?id=${id}`, null, "profile_id");
      }
      if ((firstLower === "pages" || firstLower === "people") && segments[1]) {
        const nameSlug = segments[1];
        const id = segments[2] || null;
        const canonicalPath = id ? `/${firstLower}/${nameSlug}/${id}` : `/${firstLower}/${nameSlug}`;
        return ok(`https://${canonicalHost}${canonicalPath}`, nameSlug.replace(/[-_]+/g, " ").trim(), firstLower);
      }
      // Vanity handle -- the common case.
      return ok(`https://${canonicalHost}/${first}`, first, "vanity");
    }
    case "instagram": {
      if (!first) return invalid(originalUrl, platform, canonicalHost, "SOCIAL_PROFILE_IDENTITY_UNRESOLVED");
      return ok(`https://${canonicalHost}/${first}`, first, "handle");
    }
    case "tiktok": {
      if (!first || !first.startsWith("@")) return invalid(originalUrl, platform, canonicalHost, "SOCIAL_PROFILE_IDENTITY_UNRESOLVED");
      return ok(`https://${canonicalHost}/${first}`, first.slice(1), "handle");
    }
    case "youtube": {
      if (!first) return invalid(originalUrl, platform, canonicalHost, "SOCIAL_PROFILE_IDENTITY_UNRESOLVED");
      if (first.startsWith("@")) return ok(`https://${canonicalHost}/${first}`, first.slice(1), "handle");
      if ((firstLower === "channel" || firstLower === "c" || firstLower === "user") && segments[1]) {
        return ok(`https://${canonicalHost}/${firstLower}/${segments[1]}`, segments[1], firstLower);
      }
      return invalid(originalUrl, platform, canonicalHost, "SOCIAL_PROFILE_IDENTITY_UNRESOLVED");
    }
    case "x": {
      if (!first) return invalid(originalUrl, platform, canonicalHost, "SOCIAL_PROFILE_IDENTITY_UNRESOLVED");
      return ok(`https://${canonicalHost}/${first}`, first, "handle");
    }
    case "linkedin": {
      if (firstLower === "company" && segments[1]) return ok(`https://${canonicalHost}/company/${segments[1]}`, segments[1], "company");
      if (!first) return invalid(originalUrl, platform, canonicalHost, "SOCIAL_PROFILE_IDENTITY_UNRESOLVED");
      return ok(`https://${canonicalHost}/${segments.join("/")}`, first, "profile");
    }
  }
}

/** Crawl-frontier-style identity for social PROFILES specifically --
 * distinct from domainKey() the same way pageKey() is distinct from it for
 * websites. domainKey("facebook.com/businessA") and
 * domainKey("facebook.com/businessB") are identical (same platform); their
 * socialProfileKey()s must NOT be, or two different businesses' Facebook
 * pages collapse into one identity. An invalid/unresolved URL gets a key
 * derived from its own lowercased text so it never collides with a real
 * profile's key, while still being stable for repeated-invalid-input
 * dedup. */
export function socialProfileKey(url: string): string {
  const identity = normalizeSocialProfileUrl(url);
  if (identity.valid && identity.canonicalUrl) return identity.canonicalUrl.toLowerCase();
  return `invalid:${identity.rejectionReason ?? "unknown"}:${url.trim().toLowerCase()}`;
}
