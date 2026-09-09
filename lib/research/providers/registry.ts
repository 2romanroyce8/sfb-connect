import type { DiscoveryProvider, DiscoveryProviderId } from "./types";
import { exaProvider } from "./exa";
import { bingProvider } from "./bing";
import { serpProvider } from "./serp";
import { publicWebProvider } from "./public-web";

// The ONLY place that knows the full provider list and priority order.
// Nothing else in the research engine should check an API-key env var or
// import a specific provider file directly -- swapping, adding, or
// deprioritizing a provider means editing this file (and its own provider
// file), never the orchestrator or recursive-expansion logic.
const PROVIDERS: DiscoveryProvider[] = [exaProvider, bingProvider, serpProvider, publicWebProvider];
const PROVIDER_PRIORITY: DiscoveryProviderId[] = ["exa", "bing", "serp", "public_web"];

export function listProviders(): DiscoveryProvider[] {
  return PROVIDERS;
}

export async function getProviderStatuses() {
  return Promise.all(
    PROVIDERS.map(async (p) => ({
      id: p.id,
      configured: p.isConfigured(),
      health: await p.healthCheck(),
    }))
  );
}

/**
 * Returns the highest-priority provider that is actually configured, or
 * null if none are. Callers MUST treat null as "search could not run" --
 * never silently as "nothing was found" (that's a materially different,
 * dishonest claim -- see DiscoveryUnavailable vs NotFound in
 * lib/research/discovery/websiteDiscovery.ts).
 */
export function getAvailableDiscoveryProvider(): DiscoveryProvider | null {
  for (const id of PROVIDER_PRIORITY) {
    const provider = PROVIDERS.find((p) => p.id === id);
    if (provider?.isConfigured()) return provider;
  }
  return null;
}
