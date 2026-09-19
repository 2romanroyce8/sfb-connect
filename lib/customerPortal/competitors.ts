import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CompetitorSummary = {
  id: string;
  name: string;
  website: string | null;
  trackedSince: string;
  observedQueries: number;
  detectedQueries: number;
  lastChecked: string | null;
};

/**
 * IMPORTANT DATA-MODEL HONESTY NOTE: `competitors` rows are CUSTOMER-
 * ENTERED (captured during onboarding intake -- name/website/notes typed
 * in by the business owner), not research-discovered or AI-observed. A
 * competitor only gets real AI-presence numbers once
 * ai_visibility_observations rows exist with that competitor_id set (SFB
 * actually checking the SAME queries for that competitor). Until then, it
 * is honestly "not yet monitored" -- never a fabricated 0 or absence
 * treated as "not visible."
 */
export async function getCompetitorSummaries(businessId: string): Promise<CompetitorSummary[]> {
  const supabase = createSupabaseServerClient();
  const [{ data: competitors }, { data: observations }] = await Promise.all([
    supabase.from("competitors").select("id, name, website, created_at").eq("business_id", businessId).order("created_at", { ascending: false }),
    supabase
      .from("ai_visibility_observations")
      .select("competitor_id, status, checked_at")
      .eq("business_id", businessId)
      .not("competitor_id", "is", null),
  ]);

  return (competitors ?? []).map((c) => {
    const rows = (observations ?? []).filter((o) => o.competitor_id === c.id);
    const checkedRows = rows.filter((r) => r.checked_at);
    return {
      id: c.id,
      name: c.name,
      website: c.website,
      trackedSince: c.created_at,
      observedQueries: rows.length,
      detectedQueries: rows.filter((r) => r.status === "detected").length,
      lastChecked: checkedRows.length > 0 ? checkedRows.sort((a, b) => new Date(b.checked_at!).getTime() - new Date(a.checked_at!).getTime())[0].checked_at : null,
    };
  });
}

export type HeadToHeadRow = {
  queryText: string;
  platform: string;
  yourStatus: string;
  competitorStatus: string;
  yourPosition: number | null;
  competitorPosition: number | null;
};

/**
 * Only compares observations that share the EXACT same query_text +
 * platform + location_id context between your business and one
 * competitor -- this is what makes it a genuine head-to-head rather than
 * two unrelated numbers placed side by side.
 */
export async function getHeadToHead(businessId: string, competitorId: string): Promise<HeadToHeadRow[]> {
  const supabase = createSupabaseServerClient();
  const [{ data: yours }, { data: theirs }] = await Promise.all([
    supabase
      .from("ai_visibility_observations")
      .select("query_text, platform, location_id, status, observed_position, created_at")
      .eq("business_id", businessId)
      .is("competitor_id", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("ai_visibility_observations")
      .select("query_text, platform, location_id, status, observed_position, created_at")
      .eq("business_id", businessId)
      .eq("competitor_id", competitorId)
      .order("created_at", { ascending: false }),
  ]);

  type ObsRow = { query_text: string; platform: string; location_id: string | null; status: string; observed_position: number | null; created_at: string };

  const latestYours = new Map<string, ObsRow>();
  for (const row of (yours ?? []) as ObsRow[]) {
    const key = `${row.platform}::${row.query_text}::${row.location_id ?? ""}`;
    if (!latestYours.has(key)) latestYours.set(key, row);
  }
  const latestTheirs = new Map<string, ObsRow>();
  for (const row of (theirs ?? []) as ObsRow[]) {
    const key = `${row.platform}::${row.query_text}::${row.location_id ?? ""}`;
    if (!latestTheirs.has(key)) latestTheirs.set(key, row);
  }

  const rows: HeadToHeadRow[] = [];
  for (const [key, mine] of latestYours) {
    const theirRow = latestTheirs.get(key);
    if (!theirRow) continue; // only genuinely comparable pairs, never one-sided guesses
    rows.push({
      queryText: mine.query_text,
      platform: mine.platform,
      yourStatus: mine.status,
      competitorStatus: theirRow.status,
      yourPosition: mine.observed_position,
      competitorPosition: theirRow.observed_position,
    });
  }
  return rows;
}
