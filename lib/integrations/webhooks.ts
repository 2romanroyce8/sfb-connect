import crypto from "node:crypto";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { encryptToken, decryptToken } from "@/lib/crm/tokenCrypto";

/**
 * Outbound webhooks. Every endpoint has its own signing secret (shown once at
 * creation, stored encrypted). Deliveries are signed Stripe-style:
 *   X-SFB-Signature: t=<unix>,v1=<hex hmac_sha256(secret, `${t}.${body}`)>
 * Receivers recompute and compare. Every attempt is logged.
 */
export const WEBHOOK_EVENTS = ["task.created", "task.result_posted", "task.reviewed", "prospect_feed.run_completed", "credits.charged", "webhook.test"] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export function signPayload(secret: string, body: string, ts = Math.floor(Date.now() / 1000)) {
  const v1 = crypto.createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
  return `t=${ts},v1=${v1}`;
}
export function verifySignature(secret: string, body: string, header: string, toleranceSec = 300): boolean {
  const m = /t=(\d+),v1=([a-f0-9]+)/.exec(header ?? "");
  if (!m) return false;
  const ts = Number(m[1]);
  if (Math.abs(Date.now() / 1000 - ts) > toleranceSec) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
  return expected.length === m[2].length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(m[2]));
}

export async function createEndpoint(ownerId: string, input: { url: string; events?: string[]; description?: string }) {
  const url = new URL(input.url);
  if (url.protocol !== "https:") throw new Error("Webhook URLs must be https.");
  const secret = `whsec_${crypto.randomBytes(24).toString("base64url")}`;
  const service = createSupabaseServiceClient();
  const { data, error } = await service.from("webhook_endpoints").insert({ owner_id: ownerId, url: url.toString(), secret_enc: encryptToken(secret), events: input.events?.length ? input.events : ["*"], description: input.description ?? null }).select("id, url, events, created_at").single();
  if (error) throw new Error(error.message);
  return { ...(data as { id: string; url: string; events: string[]; created_at: string }), secret };
}

export async function deleteEndpoint(id: string) {
  await createSupabaseServiceClient().from("webhook_endpoints").delete().eq("id", id);
}

/** Fan out one event to every active endpoint subscribed to it. Never throws; failures are logged per endpoint. */
export async function emitWebhook(event: WebhookEvent | string, payload: Record<string, unknown>, f: typeof fetch = fetch): Promise<{ attempted: number; delivered: number }> {
  const service = createSupabaseServiceClient();
  const { data } = await service.from("webhook_endpoints").select("id, url, secret_enc, events").eq("active", true);
  const targets = ((data ?? []) as { id: string; url: string; secret_enc: string; events: string[] }[]).filter((e) => e.events.includes("*") || e.events.includes(event));
  let delivered = 0;
  const body = JSON.stringify({ id: crypto.randomUUID(), event, created_at: new Date().toISOString(), data: payload });
  await Promise.all(targets.map(async (e) => {
    const started = Date.now();
    let status: number | null = null, ok = false, error: string | null = null;
    try {
      const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 8000);
      const res = await f(e.url, { method: "POST", headers: { "content-type": "application/json", "user-agent": "SFBConnect-Webhooks/1.0", "x-sfb-event": event, "x-sfb-signature": signPayload(decryptToken(e.secret_enc), body) }, body, signal: ctrl.signal });
      clearTimeout(timer);
      status = res.status; ok = res.ok;
      if (ok) delivered++;
    } catch (err) { error = err instanceof Error ? err.message.slice(0, 300) : "delivery failed"; }
    await service.from("webhook_deliveries").insert({ endpoint_id: e.id, event, payload: JSON.parse(body), status_code: status, ok, error, duration_ms: Date.now() - started });
    if (ok) await service.from("webhook_endpoints").update({ last_delivery_at: new Date().toISOString(), failure_count: 0 }).eq("id", e.id);
    else {
      const { data: cur } = await service.from("webhook_endpoints").select("failure_count").eq("id", e.id).single();
      await service.from("webhook_endpoints").update({ last_delivery_at: new Date().toISOString(), failure_count: ((cur?.failure_count as number) ?? 0) + 1 }).eq("id", e.id);
    }
  }));
  return { attempted: targets.length, delivered };
}

// ---- Inbound -----------------------------------------------------------
export async function createInboundToken(ownerId: string, label: string, fileTask = true) {
  const token = `sfbin_${crypto.randomBytes(24).toString("base64url")}`;
  const service = createSupabaseServiceClient();
  const { data, error } = await service.from("inbound_webhook_tokens").insert({ owner_id: ownerId, label, token_hash: sha256(token), file_task: fileTask }).select("id, label, created_at").single();
  if (error) throw new Error(error.message);
  return { ...(data as { id: string; label: string; created_at: string }), token, url: `${(process.env.NEXT_PUBLIC_APP_URL || "https://www.sfbconnect.com").replace(/\/$/, "")}/api/webhooks/in/${token}` };
}
export const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export async function lookupInboundToken(token: string) {
  const service = createSupabaseServiceClient();
  const { data } = await service.from("inbound_webhook_tokens").select("id, owner_id, label, file_task").eq("token_hash", sha256(token)).maybeSingle();
  return (data as { id: string; owner_id: string; label: string; file_task: boolean } | null) ?? null;
}
