// G5 — retry failed owner-alert deliveries on the hourly cron (Roman, 2026-10-12).
// Before this, a Resend failure was logged in notification_deliveries and that
// was the end of it; only the in-app bell survived an outage. Now: a failed SMS
// (gateway) or email row is retried after 10 minutes, up to 3 attempts, within
// 24 hours. Each retry is a new row (`retry_of` → original, `attempts` + 1);
// the original is stamped `retried_at` first so two cron runs can't both take it.
// Notifications only — this never touches outreach (outbound_messages has its own retry, G6).
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/resend";

export const RETRY_MIN_AGE_MS = 10 * 60_000;
export const RETRY_MAX_AGE_MS = 24 * 60 * 60_000;
export const RETRY_MAX_ATTEMPTS = 3;
export const RETRY_BATCH = 50;

export type FailedDelivery = {
  id: string; user_id: string | null; trigger: string; channel: string; to_address: string | null; body: string | null;
  part: number | null; parts: number | null; status: string; reason: string | null; attempts: number | null; retried_at: string | null;
  created_at: string; detail: { email?: { subject?: string; html?: string; text?: string } } | null;
};

/** Pure: can this row be retried now? Returns the reason it can't, or null when it can. */
export function retryBlocker(row: FailedDelivery, nowMs: number = Date.now()): string | null {
  if (row.status !== "failed") return "not_failed";
  if (row.channel !== "sms" && row.channel !== "email") return "channel";
  if (!(row.reason ?? "").startsWith("send_failed:")) return "not_a_send_failure";
  if (row.retried_at) return "already_retried";
  if ((row.attempts ?? 1) >= RETRY_MAX_ATTEMPTS) return "exhausted";
  if (!row.to_address) return "no_address";
  const age = nowMs - Date.parse(row.created_at);
  if (age < RETRY_MIN_AGE_MS) return "too_soon";
  if (age > RETRY_MAX_AGE_MS) return "too_old";
  if (row.channel === "sms" && !row.body) return "no_payload";
  if (row.channel === "email" && !(row.detail?.email?.html || row.detail?.email?.text)) return "no_payload"; // rows logged before the payload was kept
  return null;
}

/** Runs once per cron tick. Never throws. */
export async function retryFailedDeliveries(service: SupabaseClient, nowMs: number = Date.now()): Promise<{ considered: number; retried: number; recovered: number; exhausted: number; skipped: Record<string, number> }> {
  const out = { considered: 0, retried: 0, recovered: 0, exhausted: 0, skipped: {} as Record<string, number> };
  const since = new Date(nowMs - RETRY_MAX_AGE_MS).toISOString();
  const { data, error } = await service.from("notification_deliveries").select("id, user_id, trigger, channel, to_address, body, part, parts, status, reason, attempts, retried_at, created_at, detail")
    .eq("status", "failed").is("retried_at", null).in("channel", ["sms", "email"]).gte("created_at", since).order("created_at", { ascending: true }).limit(RETRY_BATCH);
  if (error) { console.error("[alerts] retry select failed:", error.message); return out; }
  for (const row of (data ?? []) as FailedDelivery[]) {
    out.considered++;
    const why = retryBlocker(row, nowMs);
    if (why) { out.skipped[why] = (out.skipped[why] ?? 0) + 1; continue; }
    // Claim first (exactly-once across overlapping runs): only proceed if we were the one to stamp it.
    const { data: claimed } = await service.from("notification_deliveries").update({ retried_at: new Date(nowMs).toISOString() }).eq("id", row.id).is("retried_at", null).select("id");
    if (!claimed || claimed.length === 0) { out.skipped.claimed_elsewhere = (out.skipped.claimed_elsewhere ?? 0) + 1; continue; }
    const attempt = (row.attempts ?? 1) + 1;
    const r = row.channel === "sms"
      ? await sendEmail({ to: row.to_address!, subject: "", text: row.body ?? "" })
      : await sendEmail({ to: row.to_address!, subject: row.detail?.email?.subject ?? row.body ?? "", html: row.detail?.email?.html, text: row.detail?.email?.text });
    out.retried++;
    if (r.sent) out.recovered++; else if (attempt >= RETRY_MAX_ATTEMPTS) out.exhausted++;
    const { error: insErr } = await service.from("notification_deliveries").insert({
      user_id: row.user_id, trigger: row.trigger, channel: row.channel, to_address: row.to_address, body: row.body, part: row.part, parts: row.parts,
      status: r.sent ? "sent" : "failed", reason: r.sent ? `retry_${attempt}_ok` : `send_failed:${r.error ?? r.skipped ?? "unknown"}`,
      provider_id: r.id ?? null, retry_of: row.id, attempts: attempt, detail: row.detail,
    });
    if (insErr) console.error("[alerts] retry log failed:", insErr.message);
  }
  return out;
}
