import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/resend";

// ============================================================
// EMAIL VERIFICATION GATE
// 6-digit code, 10-minute expiry, 5 attempts per code, 3 resends with a
// 60-second cooldown. Codes are stored hashed. The pending identity rides
// in a signed cookie, never as a client-supplied id.
// ============================================================

export const CODE_TTL_MIN = 10;
export const MAX_ATTEMPTS = 5;
export const MAX_RESENDS = 3;
export const RESEND_COOLDOWN_SEC = 60;
export const PENDING_COOKIE = "sfb_demo_pending";

const secret = () => process.env.CALENDAR_TOKEN_ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "sfb-demo";
const hashCode = (code: string, userId: string) => crypto.createHmac("sha256", secret()).update(`${userId}:${code}`).digest("hex");
const randomCode = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");

/** Pure: the resend decision from the user's code history (newest first). */
export function resendDecision(history: { created_at: string }[], now = Date.now()): { ok: true } | { ok: false; reason: "cooldown" | "max_resends"; retryInSec?: number } {
  if (history.length >= MAX_RESENDS + 1) return { ok: false, reason: "max_resends" };
  const last = history[0] ? Date.parse(history[0].created_at) : 0;
  const wait = RESEND_COOLDOWN_SEC - Math.floor((now - last) / 1000);
  return wait > 0 ? { ok: false, reason: "cooldown", retryInSec: wait } : { ok: true };
}

export function signPending(p: { userId: string; email: string; businessId: string }): string {
  const body = Buffer.from(JSON.stringify({ ...p, iat: Date.now() })).toString("base64url");
  return `${body}.${crypto.createHmac("sha256", secret()).update(body).digest("base64url")}`;
}
export function readPending(token: string | undefined | null): { userId: string; email: string; businessId: string } | null {
  if (!token) return null;
  const [body, sig] = token.split("."); if (!body || !sig) return null;
  const want = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  if (sig.length !== want.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null;
  try { const p = JSON.parse(Buffer.from(body, "base64url").toString()); if (Date.now() - p.iat > 24 * 3600_000) return null; return { userId: p.userId, email: p.email, businessId: p.businessId }; } catch { return null; }
}

export async function issueCode(service: SupabaseClient, userId: string, email: string, businessName: string | null, opts: { isResend?: boolean } = {}): Promise<{ ok: true } | { ok: false; reason: "cooldown" | "max_resends" | "send_failed"; retryInSec?: number }> {
  const { data: history } = await service.from("email_verification_codes").select("created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(10);
  if (opts.isResend) { const d = resendDecision(history ?? []); if (!d.ok) return d; }
  const code = randomCode();
  await service.from("email_verification_codes").update({ consumed_at: new Date().toISOString() }).eq("user_id", userId).is("consumed_at", null);
  await service.from("email_verification_codes").insert({ user_id: userId, email, code_hash: hashCode(code, userId), expires_at: new Date(Date.now() + CODE_TTL_MIN * 60_000).toISOString() });
  const r = await sendEmail({ to: email, subject: `${code} is your SFB Connect code`, ...verificationEmail(code, businessName) });
  if (!r.sent) {
    // The reason must be readable without Vercel logs: operator row (no code, no secrets).
    console.error("[demo] verification email not sent", r.error ?? r.skipped);
    await service.from("billing_audit_log").insert({ business_id: null, action: "email_send_failed", detail: { purpose: "demo_verification", to_domain: email.split("@")[1] ?? null, error: r.error ?? null, skipped: r.skipped ?? null, user_id: userId } }).then(() => undefined, () => undefined);
    return { ok: false, reason: "send_failed" };
  }
  await service.from("billing_audit_log").insert({ business_id: null, action: "email_sent", detail: { purpose: "demo_verification", to_domain: email.split("@")[1] ?? null, resend_id: r.id ?? null, user_id: userId } }).then(() => undefined, () => undefined);
  return { ok: true };
}

export async function verifyCode(service: SupabaseClient, userId: string, code: string): Promise<{ ok: true } | { ok: false; reason: "invalid" | "expired" | "too_many_attempts" | "no_code" }> {
  const { data: row } = await service.from("email_verification_codes").select("id, code_hash, expires_at, attempts").eq("user_id", userId).is("consumed_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!row) return { ok: false, reason: "no_code" };
  if (Date.parse(row.expires_at) < Date.now()) return { ok: false, reason: "expired" };
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, reason: "too_many_attempts" };
  const want = hashCode(code.replace(/\D/g, ""), userId);
  const good = want.length === row.code_hash.length && crypto.timingSafeEqual(Buffer.from(want), Buffer.from(row.code_hash));
  if (!good) { await service.from("email_verification_codes").update({ attempts: row.attempts + 1 }).eq("id", row.id); return { ok: false, reason: "invalid" }; }
  await service.from("email_verification_codes").update({ consumed_at: new Date().toISOString() }).eq("id", row.id);
  return { ok: true };
}

function verificationEmail(code: string, businessName: string | null) {
  const who = businessName ? ` for ${businessName}` : "";
  return {
    html: `<!doctype html><html><body style="margin:0;background:#000;color:#f5f5f7;font-family:Inter,Helvetica,Arial,sans-serif"><div style="max-width:560px;margin:0 auto;padding:40px 24px"><div style="font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#8a8a8f">SFB Connect</div><h1 style="font-size:22px;margin:16px 0 12px;letter-spacing:-.02em">Your agent is ready${who} — verify your email to put it to work.</h1><div style="font-size:40px;letter-spacing:.3em;font-weight:700;margin:20px 0">${code}</div><div style="font-size:14px;line-height:1.6;color:#c9c9ce">This code expires in ${CODE_TTL_MIN} minutes. If you didn't start an SFB Connect demo, ignore this email.</div></div></body></html>`,
    text: `Your SFB Connect code is ${code}. It expires in ${CODE_TTL_MIN} minutes. Your agent is ready${who} — verify your email to put it to work.`,
  };
}
