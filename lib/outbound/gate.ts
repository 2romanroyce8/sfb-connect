// Pure rules for the outbound pipeline — no I/O, fully unit-tested.
// The approval gate lives here so no caller can send around it.
import crypto from "node:crypto";

export type MessageStatus = "draft" | "pending_approval" | "approved" | "rejected" | "sent" | "simulated" | "failed" | "bounced" | "received";

export type SendableMessage = { id: string; status: MessageStatus; approved_by: string | null; approved_at: string | null; to_email: string | null; direction: "out" | "in" };

/** The HARD gate: only an approved, human-attributed, outbound message with a recipient may be sent. */
export function canSend(m: SendableMessage, suppressed: boolean): { ok: true } | { ok: false; reason: string } {
  if (m.direction !== "out") return { ok: false, reason: "not_outbound" };
  if (m.status !== "approved") return { ok: false, reason: `status_${m.status}` };
  if (!m.approved_by || !m.approved_at) return { ok: false, reason: "no_human_approval" };
  if (!m.to_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.to_email)) return { ok: false, reason: "no_valid_recipient" };
  if (suppressed) return { ok: false, reason: "suppressed" };
  return { ok: true };
}

/** Which sequence steps are due for a prospect given when the sequence started and what was already sent. */
export function dueSteps(steps: { day: number; template: string }[], startedAt: Date, sentSteps: number[], now = new Date()): number[] {
  const elapsedDays = Math.floor((now.getTime() - startedAt.getTime()) / 86_400_000);
  return steps.map((s, i) => ({ s, i })).filter(({ s, i }) => s.day <= elapsedDays && !sentSteps.includes(i)).map(({ i }) => i);
}

/** Open business-hour slots (Mon–Fri, 9:00–17:00 local) of `minutes` length that don't overlap busy blocks. */
export function proposeSlots(busy: { start: string; end: string }[], opts: { from: Date; days: number; minutes: number; tzOffsetMinutes: number; count: number }): { start: string; end: string }[] {
  const out: { start: string; end: string }[] = [];
  const busyMs = busy.map((b) => [Date.parse(b.start), Date.parse(b.end)] as const);
  const dayMs = 86_400_000;
  const startLocal = new Date(opts.from.getTime() + opts.tzOffsetMinutes * 60_000);
  for (let d = 1; d <= opts.days && out.length < opts.count; d++) {
    const day = new Date(Date.UTC(startLocal.getUTCFullYear(), startLocal.getUTCMonth(), startLocal.getUTCDate() + d));
    const dow = day.getUTCDay(); if (dow === 0 || dow === 6) continue;
    for (const hour of [10, 14, 11, 15, 9, 16]) {
      if (out.length >= opts.count) break;
      const localStart = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour, 0);
      const start = localStart - opts.tzOffsetMinutes * 60_000; const end = start + opts.minutes * 60_000;
      if (end > start + dayMs) continue;
      const clash = busyMs.some(([bs, be]) => start < be && end > bs);
      if (!clash && !out.some((s) => Date.parse(s.start) === start)) out.push({ start: new Date(start).toISOString(), end: new Date(end).toISOString() });
    }
  }
  return out.sort((a, b) => Date.parse(a.start) - Date.parse(b.start)).slice(0, opts.count);
}

/** Per-message unsubscribe token: derived, never stored, not reversible. */
export function unsubscribeToken(messageId: string, businessId: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(`${messageId}:${businessId}`).digest("hex").slice(0, 40);
}

/** Picks the email to use from what the page actually exposed. Role addresses are fine; never invent one. */
export function pickEmail(emails: string[], domain: string | null): { email: string; source: "mailto" | "visible" } | null {
  const clean = Array.from(new Set(emails.map((e) => e.toLowerCase().trim()))).filter((e) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(e) && !/example\.|sentry|wixpress|godaddy|squarespace|@2x|\.png|\.jpg/.test(e));
  if (!clean.length) return null;
  const onDomain = domain ? clean.filter((e) => e.endsWith(`@${domain}`)) : [];
  const pool = onDomain.length ? onDomain : clean;
  const pref = ["info@", "hello@", "office@", "contact@", "sales@", "admin@"];
  const best = pool.find((e) => pref.some((p) => e.startsWith(p))) ?? pool[0];
  return { email: best, source: "mailto" };
}

export const toE164 = (raw: string): string | null => { const d = raw.replace(/\D/g, ""); if (d.length === 10) return `+1${d}`; if (d.length === 11 && d.startsWith("1")) return `+${d}`; return null; };
