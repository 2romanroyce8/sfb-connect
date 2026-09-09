import type { DiscoveryProvider, DiscoveryQuery, DiscoveryResult, ProviderHealth } from "./types";

// Deliberately always reports UNAVAILABLE. There is no reliable, ToS-
// compliant, keyless general web-search endpoint to fall back to -- every
// option either requires an API key (covered by the other providers) or
// means scraping a search engine's results page, which this project's
// standing rule explicitly forbids (no stealth scraping, no pretending to
// be a human browser, no circumventing a platform's access controls).
// This entry exists so the registry has an honest, documented "last
// resort" slot rather than silently having none -- if a licensed, keyless
// public-web discovery source is ever added, it plugs in here.
export const publicWebProvider: DiscoveryProvider = {
  id: "public_web",

  isConfigured() {
    return false;
  },

  async healthCheck(): Promise<ProviderHealth> {
    return { available: false, message: "No keyless public-web discovery source is configured." };
  },

  async search(_request: DiscoveryQuery): Promise<DiscoveryResult[]> {
    return [];
  },
};
