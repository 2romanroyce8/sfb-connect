import type { DiscoveryProvider, DiscoveryQuery, DiscoveryResult, ProviderHealth } from "./types";

// Configured via BING_SEARCH_API_KEY (Azure Cognitive Services Bing Web
// Search resource). Not configured in this deployment yet -- kept as a real
// implementation, not a stub, so setting the env var is the entire
// activation step.
export const bingProvider: DiscoveryProvider = {
  id: "bing",

  isConfigured() {
    return !!process.env.BING_SEARCH_API_KEY;
  },

  async healthCheck(): Promise<ProviderHealth> {
    if (!process.env.BING_SEARCH_API_KEY) return { available: false, message: "BING_SEARCH_API_KEY is not configured." };
    return { available: true };
  },

  async search(request: DiscoveryQuery): Promise<DiscoveryResult[]> {
    const key = process.env.BING_SEARCH_API_KEY;
    if (!key) return [];
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 9000);
      const params = new URLSearchParams({ q: request.query, count: String(request.maxResults ?? 8) });
      const res = await fetch(`https://api.bing.microsoft.com/v7.0/search?${params.toString()}`, {
        headers: { "Ocp-Apim-Subscription-Key": key },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) return [];
      const data = await res.json();
      const now = new Date().toISOString();
      return ((data.webPages?.value || []) as any[]).map(
        (r, i): DiscoveryResult => ({
          title: r.name || null,
          url: r.url,
          description: r.snippet || null,
          provider: "bing",
          rank: i + 1,
          discoveredAt: now,
        })
      );
    } catch {
      return [];
    }
  },
};
