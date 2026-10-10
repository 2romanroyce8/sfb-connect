import crypto from "node:crypto";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { sha256 } from "./webhooks";

/**
 * Zapier integration = API-key auth + REST Hooks. A Zapier app ("SFB Connect")
 * authenticates with an API key the owner generates here, subscribes its
 * trigger URLs via /api/zapier/subscribe, and we POST events to them. The key
 * is shown once; only its SHA-256 is stored.
 */
export const ZAPIER_EVENTS = ["task.created", "task.result_posted", "prospect_feed.run_completed", "credits.charged"] as const;

export async function createZapierKey(ownerId: string, label = "Zapier") {
  const key = `sfbz_${crypto.randomBytes(24).toString("base64url")}`;
  const service = createSupabaseServiceClient();
  const { data, error } = await service.from("zapier_api_keys").insert({ owner_id: ownerId, label, key_hash: sha256(key) }).select("id, label, created_at").single();
  if (error) throw new Error(error.message);
  return { ...(data as { id: string; label: string; created_at: string }), key };
}

export async function authenticateZapierKey(key: string | null): Promise<{ id: string; owner_id: string } | null> {
  if (!key || !key.startsWith("sfbz_")) return null;
  const service = createSupabaseServiceClient();
  const { data } = await service.from("zapier_api_keys").select("id, owner_id").eq("key_hash", sha256(key)).maybeSingle();
  if (data) await service.from("zapier_api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  return (data as { id: string; owner_id: string } | null) ?? null;
}

export async function subscribe(apiKeyId: string, event: string, targetUrl: string) {
  if (!(ZAPIER_EVENTS as readonly string[]).includes(event)) throw new Error(`Unknown event ${event}`);
  const u = new URL(targetUrl); if (!/hooks\.zapier\.com$/.test(u.hostname) && u.protocol !== "https:") throw new Error("target_url must be https");
  const service = createSupabaseServiceClient();
  const { data, error } = await service.from("zapier_subscriptions").upsert({ api_key_id: apiKeyId, event, target_url: targetUrl }, { onConflict: "api_key_id,event,target_url" }).select("id").single();
  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}
export async function unsubscribe(apiKeyId: string, id: string) {
  await createSupabaseServiceClient().from("zapier_subscriptions").delete().eq("api_key_id", apiKeyId).eq("id", id);
}

/** Deliver an event to every Zapier subscription for it. Never throws. */
export async function emitZapier(event: string, payload: Record<string, unknown>, f: typeof fetch = fetch): Promise<number> {
  const service = createSupabaseServiceClient();
  const { data } = await service.from("zapier_subscriptions").select("target_url").eq("event", event);
  const body = JSON.stringify({ id: crypto.randomUUID(), event, created_at: new Date().toISOString(), ...payload });
  let n = 0;
  await Promise.all(((data ?? []) as { target_url: string }[]).map(async (s) => {
    try { const r = await f(s.target_url, { method: "POST", headers: { "content-type": "application/json" }, body }); if (r.ok) n++; } catch { /* logged by Zapier side; REST hooks are best-effort */ }
  }));
  return n;
}

/** Sample payloads Zapier shows while the user builds a Zap. */
export const ZAPIER_SAMPLES: Record<string, Record<string, unknown>> = {
  "task.created": { id: "00000000-0000-0000-0000-000000000001", event: "task.created", created_at: "2026-10-10T03:00:00Z", task_id: "11111111-1111-1111-1111-111111111111", title: "Qualify 7 new roofing prospects — Tampa, FL", owner_agent: "atlas", priority: "normal" },
  "task.result_posted": { id: "00000000-0000-0000-0000-000000000002", event: "task.result_posted", created_at: "2026-10-10T04:00:00Z", task_id: "11111111-1111-1111-1111-111111111111", status: "in_review", result: "4 of 7 qualified…" },
  "prospect_feed.run_completed": { id: "00000000-0000-0000-0000-000000000003", event: "prospect_feed.run_completed", created_at: "2026-10-10T07:01:00Z", run_id: "22222222-2222-2222-2222-222222222222", accepted: 41, tasks_created: 6 },
  "credits.charged": { id: "00000000-0000-0000-0000-000000000004", event: "credits.charged", created_at: "2026-10-10T05:00:00Z", business_id: "33333333-3333-3333-3333-333333333333", action_key: "outbound.meeting_booked", credits: 5, balance_after: 145 },
};
