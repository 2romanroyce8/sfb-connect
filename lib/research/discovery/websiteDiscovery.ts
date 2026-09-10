import { getAvailableDiscoveryProvider } from "../providers/registry";
import { generateDiscoveryQueries } from "./queryGenerator";
import { classifyDiscoveryResult } from "./resultClassifier";
import { canonicalDomain } from "../normalize";
import { logDiscoveryAttempt } from "../usage";

export type WebsiteDiscoveryOutcome =
  | { status: "found"; url: string; provider: string; query: string; queriesRun: string[] }
  | { status: "not_found"; provider: string; queriesRun: string[] }
  | { status: "discovery_unavailable"; reason: string };

/**
 * The first piece of recursive expansion: when a seed source (e.g. a
 * Facebook profile) doesn't link directly to an official website, use the
 * identity signals that WERE verified (business name, handle, city, state,
 * category) to independently search the wider web for it.
 *
 * This never fabricates a result and never silently reports "not found"
 * when the search didn't actually run -- "discovery_unavailable" is a
 * distinct, honest outcome for "no provider configured" or "not enough
 * identity to search with," so the UI/QA layer can tell the difference
 * between "we looked and found nothing" and "we couldn't look."
 *
 * The returned URL is a CANDIDATE, not a verified website -- the caller
 * (LeadProfileBuilder's existing Discovery Graph) fetches and verifies it
 * like any other queued source; this function's job ends at "here's a
 * legitimate, non-infra, non-social, non-directory domain worth checking."
 */
export async function discoverOfficialWebsite(signals: {
  businessName?: string | null;
  handle?: string | null;
  city?: string | null;
  state?: string | null;
  category?: string | null;
  phone?: string | null;
}): Promise<WebsiteDiscoveryOutcome> {
  const provider = getAvailableDiscoveryProvider();
  if (!provider) {
    await logDiscoveryAttempt({ provider: null, outcome: "discovery_unavailable", queriesRun: 0, businessName: signals.businessName });
    return { status: "discovery_unavailable", reason: "No discovery provider is configured (e.g. EXA_API_KEY)." };
  }
  if (!signals.businessName && !signals.handle) {
    await logDiscoveryAttempt({ provider: provider.id, outcome: "discovery_unavailable", queriesRun: 0, businessName: signals.businessName });
    return { status: "discovery_unavailable", reason: "Not enough verified identity to generate a search query." };
  }

  const queries = generateDiscoveryQueries(
    {
      businessName: signals.businessName,
      handle: signals.handle,
      city: signals.city,
      state: signals.state,
      category: signals.category,
      phone: signals.phone,
    },
    "official_website"
  );

  if (queries.length === 0) {
    await logDiscoveryAttempt({ provider: provider.id, outcome: "discovery_unavailable", queriesRun: 0, businessName: signals.businessName });
    return { status: "discovery_unavailable", reason: "Not enough verified identity to generate a search query." };
  }

  const seenDomains = new Set<string>();
  let queriesRun = 0;
  for (const query of queries) {
    queriesRun++;
    const results = await provider.search({ query, maxResults: 8 });
    for (const r of results) {
      const cls = classifyDiscoveryResult(r);
      if (cls !== "official_website_candidate") continue;
      const domain = canonicalDomain(r.url);
      if (!domain || seenDomains.has(domain)) continue;
      seenDomains.add(domain);
      // First non-infra/non-social/non-directory candidate from the
      // highest-priority query wins the slot -- actual verification
      // (name/phone/location/category match) happens when the Discovery
      // Graph fetches this page like any other source, not here.
      await logDiscoveryAttempt({ provider: provider.id, outcome: "found", queriesRun, businessName: signals.businessName });
      return { status: "found", url: r.url, provider: provider.id, query, queriesRun: queries };
    }
  }
  await logDiscoveryAttempt({ provider: provider.id, outcome: "not_found", queriesRun, businessName: signals.businessName });
  return { status: "not_found", provider: provider.id, queriesRun: queries };
}
