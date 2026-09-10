import { createSupabaseServiceClient } from "@/lib/supabase/server";

// Real usage/cost logging for discovery provider calls. This is the ONLY
// place that writes to discovery_search_calls/discovery_attempts -- every
// row represents something that actually happened, never an estimate.
// Failures here are swallowed (best-effort) so a logging hiccup can never
// break a real research run.

export async function logSearchCall(provider: string, query: string) {
  try {
    const service = createSupabaseServiceClient();
    const { data: settings } = await service.from("discovery_budget_settings").select("cost_per_search_usd").limit(1).maybeSingle();
    const costUsd = settings?.cost_per_search_usd ?? 0.007;
    await service.from("discovery_search_calls").insert({ provider, query, cost_usd: costUsd });
  } catch {
    // best-effort only
  }
}

export async function logDiscoveryAttempt(params: {
  provider: string | null;
  outcome: "found" | "not_found" | "discovery_unavailable";
  queriesRun: number;
  businessName?: string | null;
}) {
  try {
    const service = createSupabaseServiceClient();
    await service.from("discovery_attempts").insert({
      provider: params.provider,
      outcome: params.outcome,
      queries_run: params.queriesRun,
      business_name: params.businessName ?? null,
    });
  } catch {
    // best-effort only
  }
}
