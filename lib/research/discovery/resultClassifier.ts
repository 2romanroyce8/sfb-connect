import { classifyLink, isSocialOrDirectoryHost, canonicalDomain } from "../normalize";
import type { DiscoveryResult } from "../providers/types";

// Every search result must be classified BEFORE it's treated as a website
// candidate or queued into the discovery graph -- this reuses the exact
// same infra/CDN/social denylist that fixed the static.xx.fbcdn.net bug,
// so a search result can never smuggle a CDN or tracking URL past it
// either.
const DIRECTORY_HOSTS = [
  "yelp.com", "angi.com", "thumbtack.com", "homeadvisor.com", "yellowpages.com", "bbb.org",
  "mapquest.com", "facebook.com", "instagram.com", "linkedin.com", "indeed.com", "glassdoor.com",
  "wikipedia.org", "reddit.com", "youtube.com", "tripadvisor.com", "nextdoor.com", "porch.com",
  "houzz.com", "google.com", "x.com", "twitter.com", "tiktok.com", "pinterest.com",
  "expertise.com", "clutch.co",
];

export type DiscoveryResultClass = "official_website_candidate" | "social" | "directory" | "infra" | "unknown";

export function classifyDiscoveryResult(result: DiscoveryResult): DiscoveryResultClass {
  const cls = classifyLink(result.url);
  if (cls.kind === "infra") return "infra";
  if (cls.kind === "social" || cls.kind === "linktree") return "social";

  const domain = canonicalDomain(result.url);
  if (domain && DIRECTORY_HOSTS.some((h) => domain === h || domain.endsWith(`.${h}`))) return "directory";
  if (domain && !isSocialOrDirectoryHost(result.url)) return "official_website_candidate";
  return "unknown";
}
