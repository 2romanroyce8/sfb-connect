// Discovery Provider abstraction. The research engine never checks an API
// key or imports a specific provider directly -- it only talks to this
// interface via the registry. If Exa becomes unavailable, too expensive, or
// weak for a task, a new provider file + a registry entry is the entire
// change; nothing in the orchestration/recursive-expansion code moves.

export type DiscoveryProviderId = "exa" | "bing" | "serp" | "public_web";

export interface DiscoveryQuery {
  query: string;
  maxResults?: number;
  domains?: string[];
  excludeDomains?: string[];
}

export interface DiscoveryResult {
  title: string | null;
  url: string;
  description: string | null;
  provider: DiscoveryProviderId;
  rank: number | null;
  discoveredAt: string;
}

export interface ProviderHealth {
  available: boolean;
  message?: string;
}

export interface DiscoveryProvider {
  id: DiscoveryProviderId;
  /** Synchronous, cheap check -- is a credential/config present at all. */
  isConfigured(): boolean;
  /** May be more expensive (e.g. an actual ping) -- callers should prefer
   * isConfigured() for hot paths and reserve healthCheck() for status UI. */
  healthCheck(): Promise<ProviderHealth>;
  /** Never throws -- returns [] on any failure so a flaky provider can
   * never crash a research job. */
  search(request: DiscoveryQuery): Promise<DiscoveryResult[]>;
}
