import { createSupabaseServerClient } from "@/lib/supabase/server";

export const PLATFORMS = ["chatgpt", "claude", "perplexity", "grok", "google_ai"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const PLATFORM_LABELS: Record<Platform, string> = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  perplexity: "Perplexity",
  grok: "Grok",
  google_ai: "Google AI",
};

export type ObservationStatus = "not_tested" | "detected" | "not_detected" | "error" | "inconclusive";

export type LatestObservation = {
  id: string;
  platform: Platform;
  query_text: string;
  location_id: string | null;
  status: ObservationStatus;
  observed_position: number | null;
  checked_at: string | null;
  created_at: string;
  previous_status: ObservationStatus | null;
};

/**
 * The latest observation per (platform, query_text, location_id) tuple for
 * the customer's OWN business (competitor_id is null). Each check is
 * inserted as a new row (real history), so "latest" is always derived,
 * never a mutated "current" field.
 *
 * Also resolves the previous observation for the SAME tuple so callers can
 * show "Improved" / "Declined" -- but only ever from two real rows, never
 * a manufactured comparison.
 */
export async function getLatestObservations(businessId: string): Promise<LatestObservation[]> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("ai_visibility_observations")
    .select("id, platform, query_text, location_id, status, observed_position, checked_at, created_at")
    .eq("business_id", businessId)
    .is("competitor_id", null)
    .order("created_at", { ascending: false });

  const rows = data ?? [];
  const seen = new Map<string, LatestObservation>();

  for (const row of rows) {
    const key = `${row.platform}::${row.query_text}::${row.location_id ?? ""}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, { ...row, previous_status: null } as LatestObservation);
    } else if (existing.previous_status === null) {
      // rows are already newest-first, so the second time we see this key
      // is the previous observation for that same tuple.
      existing.previous_status = row.status as ObservationStatus;
    }
  }

  return Array.from(seen.values());
}

export type PlatformStatus = "detected" | "not_detected" | "not_yet_tested" | "inconclusive" | "error";

/**
 * One truthful status per platform, aggregated from the latest observation
 * per tracked query on that platform. Priority: any detected -> "detected"
 * (the business IS visible there); else any error -> surfaced so it's not
 * silently mistaken for "not detected"; else any inconclusive; else any
 * not_detected -> "not_detected"; else (only not_tested rows, or none at
 * all) -> "not_yet_tested". Never defaults to "not detected" for a
 * platform nothing has been checked on.
 */
export function summarizeByPlatform(observations: LatestObservation[]): Record<Platform, PlatformStatus> {
  const summary = {} as Record<Platform, PlatformStatus>;
  for (const platform of PLATFORMS) {
    const rows = observations.filter((o) => o.platform === platform);
    if (rows.length === 0 || rows.every((r) => r.status === "not_tested")) {
      summary[platform] = "not_yet_tested";
    } else if (rows.some((r) => r.status === "detected")) {
      summary[platform] = "detected";
    } else if (rows.some((r) => r.status === "error")) {
      summary[platform] = "error";
    } else if (rows.some((r) => r.status === "inconclusive")) {
      summary[platform] = "inconclusive";
    } else {
      summary[platform] = "not_detected";
    }
  }
  return summary;
}

export type QueryHistoryEntry = {
  id: string;
  status: ObservationStatus;
  observed_position: number | null;
  evidence_text: string | null;
  source_url: string | null;
  checked_at: string | null;
  created_at: string;
};

/**
 * Full check history for ONE tracked (platform, query_text, location)
 * tuple -- fetched on demand (not on initial page load) so a customer with
 * years of history never loads every observation up front.
 */
export async function getQueryHistory(
  businessId: string,
  platform: string,
  queryText: string,
  locationId: string | null
): Promise<QueryHistoryEntry[]> {
  const supabase = createSupabaseServerClient();
  let query = supabase
    .from("ai_visibility_observations")
    .select("id, status, observed_position, evidence_text, source_url, checked_at, created_at")
    .eq("business_id", businessId)
    .eq("platform", platform)
    .eq("query_text", queryText)
    .is("competitor_id", null)
    .order("created_at", { ascending: false })
    .limit(25);

  query = locationId ? query.eq("location_id", locationId) : query.is("location_id", null);

  const { data } = await query;
  return (data ?? []) as QueryHistoryEntry[];
}
