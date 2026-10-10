// WhatsApp Business (Meta Cloud API). Not OAuth: the business's phone number id
// and a system-user access token live in Vercel env. Meta proves the webhook
// with a GET handshake (hub.mode/hub.verify_token/hub.challenge); passing that
// handshake is the "real test connection" that flips the registry to live.
import crypto from "node:crypto";
import type { EnvLike } from "./providers";

const trim = (v: string | undefined) => (v ?? "").trim();
export const whatsappConfigured = (env: EnvLike = process.env) => !!trim(env.WHATSAPP_PHONE_NUMBER_ID) && !!trim(env.WHATSAPP_ACCESS_TOKEN);

/**
 * The verify token Roman pastes into the Meta app. WHATSAPP_VERIFY_TOKEN if set;
 * otherwise derived (SHA-256) from the access token so nothing new has to be
 * invented or stored — it is not reversible and is shown only to the owner.
 */
export function whatsappVerifyToken(env: EnvLike = process.env): string | null {
  const explicit = trim(env.WHATSAPP_VERIFY_TOKEN);
  if (explicit) return explicit;
  const at = trim(env.WHATSAPP_ACCESS_TOKEN);
  return at ? `sfbwa_${crypto.createHash("sha256").update(at).digest("hex").slice(0, 32)}` : null;
}

/** Meta's GET handshake: echo hub.challenge iff the verify token matches. */
export function handleVerification(q: URLSearchParams, env: EnvLike = process.env): { ok: true; challenge: string } | { ok: false; reason: string } {
  const expected = whatsappVerifyToken(env);
  if (!expected) return { ok: false, reason: "not_configured" };
  if (q.get("hub.mode") !== "subscribe") return { ok: false, reason: "bad_mode" };
  const given = q.get("hub.verify_token") ?? "";
  const a = Buffer.from(given), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false, reason: "bad_token" };
  const challenge = q.get("hub.challenge");
  return challenge ? { ok: true, challenge } : { ok: false, reason: "no_challenge" };
}

/** Inbound payload signature (X-Hub-Signature-256 = sha256=HMAC(app secret, raw body)). Uses META_APP_SECRET when present. */
export function verifyMetaSignature(rawBody: string, header: string | null, env: EnvLike = process.env): boolean | null {
  const secret = trim(env.META_APP_SECRET);
  if (!secret) return null; // can't verify — caller decides (we accept but mark unverified)
  if (!header?.startsWith("sha256=")) return false;
  const mac = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(header.slice(7)), b = Buffer.from(mac);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Send a text message from the configured business number. */
export async function sendWhatsAppText(to: string, body: string, env: EnvLike = process.env, f: typeof fetch = fetch): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!whatsappConfigured(env)) return { ok: false, error: "WhatsApp is not configured." };
  const r = await f(`https://graph.facebook.com/v21.0/${trim(env.WHATSAPP_PHONE_NUMBER_ID)}/messages`, {
    method: "POST", headers: { Authorization: `Bearer ${trim(env.WHATSAPP_ACCESS_TOKEN)}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body } }),
  });
  const j = (await r.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string } };
  return r.ok ? { ok: true, id: j.messages?.[0]?.id } : { ok: false, error: j.error?.message ?? `WhatsApp answered ${r.status}` };
}
