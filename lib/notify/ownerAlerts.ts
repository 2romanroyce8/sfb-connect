// Owner alert fan-out (Roman, 2026-10-12): in-app + SMS (carrier gateway via
// Resend) + email, decided per recipient by lib/notify/sms.ts, every attempt
// logged in notification_deliveries. Rules: notifications only (never
// outreach); never fail silently — a channel that cannot go out is logged
// with its reason and falls back to email; a gateway Resend reports as
// bounced puts that person on email for 7 days (self-healing, no cron). Failed
// sends are retried by lib/notify/retry.ts on the hourly cron (G5).
import type { SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { sendEmail, resendConfigured } from "@/lib/email/resend";
import { notify, type NotificationType } from "@/lib/crm/notify";
import { decideChannels, splitSms, COALESCE_MINUTES, type NotifyUser, type Trigger } from "./sms";

export type OwnerAlert = {
  trigger: Trigger;
  /** The text message. Keep it short; split happens automatically at 160. */
  sms: string;
  email: { subject: string; html: string; text?: string };
  inApp: { type: NotificationType; title: string; body?: string; actionUrl?: string; actionLabel?: string };
  /** Defaults to every team owner. */
  userIds?: string[];
  detail?: Record<string, unknown>;
};

export type DeliveryResult = { userId: string; inApp: "sent" | "failed"; sms: string; email: string };

const USER_COLS = "id, email, team_role, team_status, notify_phone, notify_carrier, notify_prefs, notify_sms_verified_at, notify_sms_last_bounce_at";

async function recipients(service: SupabaseClient, userIds?: string[]): Promise<NotifyUser[]> {
  let q = service.from("users").select(USER_COLS);
  q = userIds ? q.in("id", userIds) : q.eq("team_role", "owner");
  const { data } = await q;
  return ((data ?? []) as (NotifyUser & { team_status: string | null })[]).filter((u) => u.team_status !== "disabled");
}

async function log(service: SupabaseClient, row: Record<string, unknown>): Promise<string | null> {
  const { data, error } = await service.from("notification_deliveries").insert(row).select("id").single();
  if (error) console.error("[alerts] log failed:", error.message);
  return (data?.id as string) ?? null;
}

/** Ask Resend what happened to the last gateway send (delivered/bounced). Marks a bounce on the user. Best-effort, ≤1 lookup per call. */
async function reconcileLastSms(service: SupabaseClient, u: NotifyUser): Promise<void> {
  if (!resendConfigured()) return;
  const { data: last } = await service.from("notification_deliveries").select("id, provider_id, created_at").eq("user_id", u.id).eq("channel", "sms").eq("status", "sent").is("provider_last_event", null).not("provider_id", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!last || Date.now() - Date.parse(last.created_at as string) < 45_000) return; // give Resend a moment to know
  try {
    const r = await new Resend(process.env.RESEND_API_KEY!.trim()).emails.get(last.provider_id as string);
    const ev = r.data?.last_event ?? null; if (!ev) return;
    await service.from("notification_deliveries").update({ provider_last_event: ev, provider_checked_at: new Date().toISOString() }).eq("id", last.id);
    if (ev === "bounced" || ev === "complained") {
      await service.from("users").update({ notify_sms_last_bounce_at: new Date().toISOString(), notify_sms_last_bounce_reason: ev }).eq("id", u.id);
      u.notify_sms_last_bounce_at = new Date().toISOString();
    }
  } catch (e) { console.error("[alerts] resend status lookup failed:", e instanceof Error ? e.message : e); }
}

/** Send one SMS (possibly several parts) through the gateway. Returns "sent" or "failed:<reason>". */
export async function sendGatewaySms(service: SupabaseClient, u: Pick<NotifyUser, "id">, trigger: Trigger, gateway: string, text: string, detail?: Record<string, unknown>): Promise<{ status: "sent" | "failed"; reason?: string; providerIds: string[] }> {
  const parts = splitSms(text); const ids: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    // Empty subject: gateways prepend the subject to the text, which wastes characters.
    const r = await sendEmail({ to: gateway, subject: "", text: parts[i] });
    await log(service, { user_id: u.id, trigger, channel: "sms", to_address: gateway, body: parts[i], part: i + 1, parts: parts.length, status: r.sent ? "sent" : "failed", reason: r.sent ? null : `send_failed:${r.error ?? r.skipped ?? "unknown"}`, provider_id: r.id ?? null, detail: detail ?? null });
    if (!r.sent) return { status: "failed", reason: r.error ?? r.skipped ?? "unknown", providerIds: ids };
    if (r.id) ids.push(r.id);
  }
  return { status: "sent", providerIds: ids };
}

/**
 * Fan an alert out to the team owners (or the given users). Channels run in
 * parallel per recipient so the call-now SLA alert is not serialized behind
 * anything. Never throws.
 */
export async function alertOwners(service: SupabaseClient, alert: OwnerAlert): Promise<DeliveryResult[]> {
  try {
    const users = await recipients(service, alert.userIds);
    return await Promise.all(users.map((u) => alertOne(service, u, alert)));
  } catch (e) {
    console.error("[alerts] fan-out failed:", e instanceof Error ? e.message : e);
    return [];
  }
}

async function alertOne(service: SupabaseClient, u: NotifyUser, alert: OwnerAlert): Promise<DeliveryResult> {
  const res: DeliveryResult = { userId: u.id, inApp: "sent", sms: "skipped", email: "skipped" };
  const inApp = (async () => {
    try { await notify(service, { userId: u.id, ...alert.inApp }); await log(service, { user_id: u.id, trigger: alert.trigger, channel: "in_app", body: alert.inApp.title, status: "sent" }); }
    catch (e) { res.inApp = "failed"; await log(service, { user_id: u.id, trigger: alert.trigger, channel: "in_app", body: alert.inApp.title, status: "failed", reason: e instanceof Error ? e.message : "unknown" }); }
  })();

  const smsAndEmail = (async () => {
    await reconcileLastSms(service, u);
    let d = decideChannels(u, alert.trigger);
    let emailWhy: string | null = d.emailReason;
    // Coalesce chatty triggers: one text per window per person.
    if (d.gateway && COALESCE_MINUTES[alert.trigger]) {
      const since = new Date(Date.now() - COALESCE_MINUTES[alert.trigger]! * 60_000).toISOString();
      const { count } = await service.from("notification_deliveries").select("id", { count: "exact", head: true }).eq("user_id", u.id).eq("trigger", alert.trigger).eq("channel", "sms").eq("status", "sent").gte("created_at", since);
      if ((count ?? 0) > 0) { await log(service, { user_id: u.id, trigger: alert.trigger, channel: "sms", to_address: d.gateway, body: alert.sms, status: "coalesced", reason: `within_${COALESCE_MINUTES[alert.trigger]}m` }); res.sms = "coalesced"; d = { ...d, gateway: null, smsSkipReason: "coalesced" }; emailWhy = d.email ? emailWhy : null; }
    }
    if (d.wantSms && d.gateway) {
      const r = await sendGatewaySms(service, u, alert.trigger, d.gateway, alert.sms, alert.detail);
      res.sms = r.status === "sent" ? `sent:${d.gateway}` : `failed:${r.reason}`;
      if (r.status === "failed" && !d.email) { emailWhy = "fallback"; }
    } else if (d.wantSms && res.sms !== "coalesced") {
      res.sms = `skipped:${d.smsSkipReason}`;
      await log(service, { user_id: u.id, trigger: alert.trigger, channel: "sms", to_address: null, body: alert.sms, status: d.email ? "fallback" : "skipped", reason: d.smsSkipReason });
    } else if (!d.wantSms) {
      res.sms = "skipped:pref_off";
    }
    const sendMail = d.email || emailWhy === "fallback";
    if (sendMail && u.email) {
      const r = await sendEmail({ to: u.email, subject: alert.email.subject, html: alert.email.html, text: alert.email.text });
      res.email = r.sent ? `sent:${emailWhy}` : `failed:${r.error ?? r.skipped}`;
      // G5: a failed email keeps its payload so the hourly retry can resend it verbatim.
      await log(service, { user_id: u.id, trigger: alert.trigger, channel: "email", to_address: u.email, body: alert.email.subject, status: r.sent ? "sent" : "failed", reason: r.sent ? emailWhy : `send_failed:${r.error ?? r.skipped ?? "unknown"}`, provider_id: r.id ?? null, detail: r.sent ? null : { email: { subject: alert.email.subject, html: alert.email.html, text: alert.email.text ?? null } } });
    } else if (sendMail && !u.email) {
      res.email = "skipped:no_email";
      await log(service, { user_id: u.id, trigger: alert.trigger, channel: "email", status: "skipped", reason: "no_email", body: alert.email.subject });
    } else if (!d.wantSms) {
      res.email = "skipped:pref_off";
    }
  })();

  await Promise.all([inApp, smsAndEmail]);
  return res;
}

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
