import type { DiscoveryProvider, DiscoveryQuery, DiscoveryResult, ProviderHealth } from "./types";

// Configured via SERP_API_KEY (SerpApi.com, a licensed search-results API --
// not a scraper). Not configured in this deployment yet -- a real
// implementation, so setting the env var is the entire activation step.
export const serpProvider: DiscoveryProvider = {
  id: "serp",

  isConfigured() {
    return !!process.env.SERP_API_KEY;
  },

  async healthCheck(): Promise<ProviderHealth> {
    if (!process.env.SERP_API_KEY) return { available: false, message: "SERP_API_KEY is not configured." };
    return { available: true };
  },

  async search(request: DiscoveryQuery): Promise<DiscoveryResult[]> {
    const key = process.env.SERP_API_KEY;
    if (!key) return [];
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 9000);
      const params = new URLSearchParams({
        q: request.query,
        api_key: key,
        num: String(request.maxResults ?? 8),
        engine: "google",
      });
      const res = await fetch(`https://serpapi.com/search.json?${params.toString()}`, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) return [];
      const data = await res.json();
      const now = new Date().toISOString();
      return ((data.organic_results || []) as any[]).map(
        (r, i): DiscoveryResult => ({
          title: r.title || null,
          url: r.link,
          description: r.snippet || null,
          provider: "serp",
          rank: i + 1,
          discoveredAt: now,
        })
      );
    } catch {
      return [];
    }
  },
};
