import { createSupabaseServiceClient } from "@/lib/supabase/server";

/** Deterministic templates -- combinations of VERIFIED service + VERIFIED
 * location + real customer intent. No invented services, no invented
 * geography, no SEO keyword stuffing, no duplicate semantic variants. */
const TEMPLATES: { type: "discovery" | "service" | "local"; build: (service: string, city: string) => string }[] = [
  { type: "discovery", build: (service, city) => `best ${service} near me` },
  { type: "local", build: (service, city) => `${service} in ${city}` },
  { type: "local", build: (service, city) => `best ${service} company in ${city}` },
];

function normalize(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, " ");
}

export type GeneratedQuery = { queryText: string; normalizedQuery: string; queryType: string; category: string | null };

/**
 * Builds a small, real query set from VERIFIED business data only --
 * business_services.primary_service + additional_services, and
 * business_locations.cities. Never fabricates a service or city the
 * business hasn't actually told SFB about. Deduplicates by normalized
 * text.
 */
export async function generateQueriesForBusiness(businessId: string): Promise<GeneratedQuery[]> {
  const supabase = createSupabaseServiceClient();
  const [{ data: services }, { data: locations }] = await Promise.all([
    supabase.from("business_services").select("primary_service, additional_services").eq("business_id", businessId).maybeSingle(),
    supabase.from("business_locations").select("cities").eq("business_id", businessId).maybeSingle(),
  ]);

  const serviceList = [services?.primary_service, ...(services?.additional_services ?? [])].filter(Boolean) as string[];
  const cityList = (locations?.cities ?? []).filter(Boolean) as string[];

  if (serviceList.length === 0) {
    // No verified service data -- generate nothing rather than guess.
    return [];
  }

  const generated = new Map<string, GeneratedQuery>();

  for (const service of serviceList) {
    // Always include one location-agnostic discovery query per service.
    const discoveryText = TEMPLATES[0].build(service, "");
    const discoveryKey = normalize(discoveryText);
    if (!generated.has(discoveryKey)) {
      generated.set(discoveryKey, { queryText: discoveryText, normalizedQuery: discoveryKey, queryType: "discovery", category: service });
    }

    for (const city of cityList) {
      for (const template of TEMPLATES.slice(1)) {
        const text = template.build(service, city);
        const key = normalize(text);
        if (!generated.has(key)) {
          generated.set(key, { queryText: text, normalizedQuery: key, queryType: template.type, category: service });
        }
      }
    }
  }

  return Array.from(generated.values());
}

/**
 * Ensures generated queries exist in tracked_queries (source=
 * 'system_generated'). Explicit check-then-insert (not .upsert()) because
 * the dedupe uniqueness is an EXPRESSION index (coalesce(location_id, ...))
 * to treat "no location" consistently -- Postgres's ON CONFLICT inference
 * can't target an expression index by plain column list, so this avoids
 * that mismatch entirely. Calling this repeatedly for the same business
 * never creates duplicate rows; it returns ALL matching tracked query ids
 * (pre-existing + newly created).
 */
export async function ensureTrackedQueries(businessId: string, locationId: string | null): Promise<string[]> {
  const supabase = createSupabaseServiceClient();
  const generated = await generateQueriesForBusiness(businessId);
  if (generated.length === 0) return [];

  let existingQuery = supabase.from("tracked_queries").select("id, normalized_query").eq("business_id", businessId);
  existingQuery = locationId ? existingQuery.eq("location_id", locationId) : existingQuery.is("location_id", null);
  const { data: existing } = await existingQuery;

  const existingByNormalized = new Map((existing ?? []).map((r) => [r.normalized_query, r.id]));
  const toInsert = generated.filter((g) => !existingByNormalized.has(g.normalizedQuery));

  if (toInsert.length > 0) {
    const { data: inserted, error } = await supabase
      .from("tracked_queries")
      .insert(
        toInsert.map((g) => ({
          business_id: businessId,
          location_id: locationId,
          query_text: g.queryText,
          normalized_query: g.normalizedQuery,
          query_type: g.queryType,
          category: g.category,
          source: "system_generated" as const,
        }))
      )
      .select("id, normalized_query");
    if (error) throw new Error(`Could not create tracked queries: ${error.message}`);
    for (const row of inserted ?? []) existingByNormalized.set(row.normalized_query, row.id);
  }

  return generated.map((g) => existingByNormalized.get(g.normalizedQuery)).filter((id): id is string => Boolean(id));
}
