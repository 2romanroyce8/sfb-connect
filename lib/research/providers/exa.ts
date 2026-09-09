import type { DiscoveryProvider, DiscoveryQuery, DiscoveryResult, ProviderHealth } from "./types";

// One discovery provider among potentially several. Exa is a neural+keyword
// web search API -- a real, general-purpose search surface, not a
// business-directory API. Configured via EXA_API_KEY.
export const exaProvider: DiscoveryProvider = {
  id: "exa",

  isConfigured() {
    return !!process.env.EXA_API_KEY;
  },

  async healthCheck(): Promise<ProviderHealth> {
    if (!process.env.EXA_API_KEY) return { available: false, message: "EXA_API_KEY is not configured." };
    return { available: true };
  },

  async search(request: DiscoveryQuery): Promise<DiscoveryResult[]> {
    const key = process.env.EXA_API_KEY;
    if (!key) return [];
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 9000);
      const res = await fetch("https://api.exa.ai/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": key },
        signal: controller.signal,
        body: JSON.stringify({
          query: request.query,
          numResults: request.maxResults ?? 8,
          type: "auto",
          contents: { text: { maxCharacters: 300 } },
          ...(request.domains?.length ? { includeDomains: request.domains } : {}),
          ...(request.excludeDomains?.length ? { excludeDomains: request.excludeDomains } : {}),
        }),
      });
      clearTimeout(timeout);
      if (!res.ok) return [];
      const data = await res.json();
      const now = new Date().toISOString();
      return (data.results || []).map(
        (r: any, i: number): DiscoveryResult => ({
          title: r.title || null,
          url: r.url,
          description: r.text || null,
          provider: "exa",
          rank: i + 1,
          discoveredAt: now,
        })
      );
    } catch {
      return [];
    }
  },
};
