// Short-lived server cache for analytics views. The Stripe mirror must never
// be fetched on every page load (Roman, 2026-10-12): results live in
// analytics_cache for TTL_MS and are refreshed in-band when stale or when the
// owner presses Refresh (which still honours a 30 s floor).
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const ANALYTICS_TTL_MS = 5 * 60 * 1000;
export const REFRESH_FLOOR_MS = 30 * 1000;

export type Cached<T> = { data: T; fetchedAt: string; fromCache: boolean; ageMs: number; error: string | null };

export async function cached<T>(key: string, loader: () => Promise<T>, opts: { force?: boolean; ttlMs?: number } = {}): Promise<Cached<T>> {
  const service = createSupabaseServiceClient();
  const ttl = opts.ttlMs ?? ANALYTICS_TTL_MS;
  const { data: row } = await service.from("analytics_cache").select("payload, fetched_at, error").eq("key", key).maybeSingle();
  const age = row ? Date.now() - new Date(row.fetched_at as string).getTime() : Infinity;
  const fresh = row && age < ttl;
  const tooSoon = row && age < REFRESH_FLOOR_MS;
  if (row && (fresh && !opts.force || tooSoon)) return { data: row.payload as T, fetchedAt: row.fetched_at as string, fromCache: true, ageMs: age, error: (row.error as string | null) ?? null };
  const started = Date.now();
  try {
    const data = await loader();
    const fetchedAt = new Date().toISOString();
    await service.from("analytics_cache").upsert({ key, payload: data as unknown as Record<string, unknown>, fetched_at: fetchedAt, duration_ms: Date.now() - started, error: null }, { onConflict: "key" });
    return { data, fetchedAt, fromCache: false, ageMs: 0, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 300) : "fetch failed";
    // Keep serving the last good payload, but say so.
    if (row) { await service.from("analytics_cache").update({ error: msg }).eq("key", key); return { data: row.payload as T, fetchedAt: row.fetched_at as string, fromCache: true, ageMs: age, error: msg }; }
    throw e;
  }
}
