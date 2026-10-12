import type { SupabaseClient } from "@supabase/supabase-js";
import { getBusyBlocks, createCalendarEvent } from "@/lib/crm/googleCalendar";
import { getAccessToken } from "@/lib/integrations/connections";
import { sendEmail } from "@/lib/email/resend";
import { notify } from "@/lib/crm/notify";

// ============================================================
// BOOK A DEMO CALL (Roman, 2026-10-12)
// All times Eastern, labeled every time. On confirm: a real event on Rome's
// Google Calendar with a Meet link and the prospect as attendee (Google
// emails the invite), plus our own confirmation with .ics / Google / Outlook
// links and the "save our number" card. "Free right now?" → the team is
// told instantly (Slack + email + in-app) — the 5-minute promise is a real
// ops commitment Roman confirmed, so the alert has to be real too.
// ============================================================

export const ET = "America/New_York";
export const SFB_PHONE_E164 = "+12135231641";
export const SFB_PHONE_DISPLAY = "213-523-1641";
export const SFB_CONTACT_NAME = "SFB CONNECT";
export const CALLBACK_PROMISE = "We'll get back to you within 5 minutes or less.";
export const SLOT_MINUTES = 30;
export const BOOKING_LEAD_MINUTES = 120;      // nothing sooner than 2 h from now
export const BOOKING_DAYS = 10;               // look-ahead window (calendar days)
export const ET_HOURS = { start: 9, end: 17 }; // 9:00 → last slot starts 16:30 ET

/** Minutes to ADD to UTC to get Eastern wall-clock at `date` (−240 EDT / −300 EST). */
export function etOffsetMinutes(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: ET, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(date);
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second"));
  return Math.round((asUtc - date.getTime()) / 60_000);
}
export const fmtET = (iso: string, opts: Intl.DateTimeFormatOptions = {}) => new Date(iso).toLocaleString("en-US", { timeZone: ET, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", ...opts }) + " ET";
export const fmtETDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { timeZone: ET, weekday: "long", month: "long", day: "numeric" });
export const fmtETTime = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { timeZone: ET, hour: "numeric", minute: "2-digit" }) + " ET";

export type Slot = { start: string; end: string };
export type SlotDay = { date: string; label: string; slots: Slot[] };

/** Pure: 30-minute weekday slots 9:00–16:30 ET for the next BOOKING_DAYS days, minus busy blocks and anything inside the lead time. */
export function buildSlots(busy: Slot[], from: Date = new Date(), days = BOOKING_DAYS): SlotDay[] {
  const busyMs = busy.map((b) => [Date.parse(b.start), Date.parse(b.end)] as const);
  const earliest = from.getTime() + BOOKING_LEAD_MINUTES * 60_000;
  const out: SlotDay[] = [];
  const startOffset = etOffsetMinutes(from); const etNow = new Date(from.getTime() + startOffset * 60_000);
  for (let d = 0; d <= days; d++) {
    const day = new Date(Date.UTC(etNow.getUTCFullYear(), etNow.getUTCMonth(), etNow.getUTCDate() + d));
    const dow = day.getUTCDay(); if (dow === 0 || dow === 6) continue;
    const slots: Slot[] = [];
    for (let m = ET_HOURS.start * 60; m < ET_HOURS.end * 60; m += SLOT_MINUTES) {
      const wall = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), Math.floor(m / 60), m % 60);
      // Offset is evaluated at the slot itself so a DST change inside the window stays correct.
      const probe = new Date(wall - startOffset * 60_000); const off = etOffsetMinutes(probe);
      const start = wall - off * 60_000; const end = start + SLOT_MINUTES * 60_000;
      if (start < earliest) continue;
      if (busyMs.some(([bs, be]) => start < be && end > bs)) continue;
      slots.push({ start: new Date(start).toISOString(), end: new Date(end).toISOString() });
    }
    if (slots.length) out.push({ date: day.toISOString().slice(0, 10), label: new Date(slots[0].start).toLocaleDateString("en-US", { timeZone: ET, weekday: "short", month: "short", day: "numeric" }), slots });
  }
  return out;
}

/** The primary owner's calendar is the demo calendar. */
export async function demoCalendarOwner(service: SupabaseClient): Promise<string | null> {
  const { data } = await service.from("users").select("id").eq("team_role", "owner").order("is_primary_owner", { ascending: false }).limit(1).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

export async function availableSlots(service: SupabaseClient, now = new Date()): Promise<{ days: SlotDay[]; calendarConnected: boolean }> {
  const ownerId = await demoCalendarOwner(service); if (!ownerId) return { days: [], calendarConnected: false };
  try {
    const busy = await getBusyBlocks(ownerId, now.toISOString(), new Date(now.getTime() + (BOOKING_DAYS + 1) * 86_400_000).toISOString());
    return { days: buildSlots(busy, now), calendarConnected: true };
  } catch { return { days: [], calendarConnected: false }; }
}

export type DemoCallInput = { name: string; email: string; phone: string; website: string | null; start: string; callNow: boolean; source: string; signupUserId?: string | null };
export class DemoCallError extends Error { constructor(public code: string, message: string, public status = 400) { super(message); } }
const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

export function parseDemoCallInput(b: Record<string, unknown>): DemoCallInput | { error: string } {
  const name = clean(b.name, 80); const email = clean(b.email, 200).toLowerCase(); const phone = clean(b.phone, 32); const website = clean(b.website, 300) || null; const start = clean(b.start, 40);
  if (name.length < 2) return { error: "Enter your name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter your email." };
  if (phone.replace(/\D/g, "").length < 10) return { error: "Enter the phone number we should call." };
  const t = Date.parse(start); if (!Number.isFinite(t)) return { error: "Pick a time." };
  return { name, email, phone, website, start: new Date(t).toISOString(), callNow: b.callNow === true, source: clean(b.source, 40) || "site" };
}

export type DemoCall = { id: string; name: string; email: string; phone: string; website: string | null; start_at: string; end_at: string; calendar_event_id: string | null; html_link: string | null; meet_url: string | null; call_now: boolean; call_now_notified_at: string | null; status: string; created_at: string };

/** Books the call. The slot is re-validated against the live calendar (no double-booking), the event is created with the prospect as attendee, the row is stored, confirmations go out. */
export async function bookDemoCall(service: SupabaseClient, input: DemoCallInput, origin: string): Promise<DemoCall> {
  const ownerId = await demoCalendarOwner(service); if (!ownerId) throw new DemoCallError("no_calendar", "Booking isn't available right now.", 503);
  const startMs = Date.parse(input.start); const endMs = startMs + SLOT_MINUTES * 60_000;
  const { days } = await availableSlots(service);
  if (!days.some((d) => d.slots.some((s) => Date.parse(s.start) === startMs))) throw new DemoCallError("slot_taken", "That time just got taken — pick another.", 409);
  const whenET = fmtET(input.start);
  let ev: { eventId: string; htmlLink: string; meetUrl: string | null };
  try {
    ev = await createCalendarEvent(ownerId, { summary: `SFB Connect demo — ${input.name}`, description: `Demo call booked from sfbconnect.com.\nName: ${input.name}\nEmail: ${input.email}\nPhone: ${input.phone}${input.website ? `\nWebsite: ${input.website}` : ""}${input.callNow ? "\n\n⚡ Asked to be called RIGHT NOW (5-minute promise)." : ""}`, startISO: new Date(startMs).toISOString(), endISO: new Date(endMs).toISOString(), timeZone: ET, attendees: [{ email: input.email, displayName: input.name }], sendUpdates: "all" });
  } catch (e) { throw new DemoCallError("calendar_failed", e instanceof Error ? e.message : "Calendar refused the event.", 502); }
  const { data, error } = await service.from("demo_calls").insert({ name: input.name, email: input.email, phone: input.phone, website: input.website, start_at: new Date(startMs).toISOString(), end_at: new Date(endMs).toISOString(), time_zone: ET, calendar_owner_id: ownerId, calendar_event_id: ev.eventId, html_link: ev.htmlLink, meet_url: ev.meetUrl, call_now: input.callNow, source: input.source, signup_user_id: input.signupUserId ?? null }).select("*").single();
  if (error || !data) throw new DemoCallError("db", error?.message ?? "Could not save the booking.", 500);
  const call = data as DemoCall;
  // Confirmation to the prospect (our branded email with .ics; Google also sends its own invite).
  void sendEmail({ to: input.email, subject: `Your SFB Connect demo — ${whenET}`, ...confirmationEmail(call, origin), attachments: [{ filename: "sfb-connect-demo.ics", content: Buffer.from(icsFor(call, origin)).toString("base64") }] });
  // Team: every booking is an in-app notification; "call now" is an instant Slack + email page.
  await notifyTeam(service, call, origin);
  return call;
}

async function notifyTeam(service: SupabaseClient, call: DemoCall, origin: string) {
  const { data: owners } = await service.from("users").select("id, email").eq("team_role", "owner");
  const line = `${call.call_now ? "⚡ CALL NOW (5-minute promise) — " : "📅 Demo booked — "}${call.name} · ${call.phone} · ${call.email}${call.website ? ` · ${call.website}` : ""} · ${fmtET(call.start_at)}${call.meet_url ? ` · ${call.meet_url}` : ""}`;
  for (const o of owners ?? []) await notify(service, { userId: o.id, type: "meeting_booked" as never, title: call.call_now ? `CALL NOW: ${call.name} is free right now` : `Demo booked: ${call.name}`, body: line, actionUrl: call.html_link ?? `${origin}/team/calendar`, actionLabel: "Open event" });
  if (!call.call_now) return;
  const results: Record<string, string> = {};
  // Slack: the connected workspace's incoming-webhook channel (#all-sfb-connect) via chat.postMessage.
  try {
    const { data: sc } = await service.from("integration_connections").select("owner_id, metadata").eq("provider", "slack").eq("status", "active").limit(1).maybeSingle();
    const channel = (sc?.metadata as { incoming_webhook?: { channel_id?: string } } | null)?.incoming_webhook?.channel_id;
    if (sc && channel) {
      const { token } = await getAccessToken("slack", sc.owner_id as string);
      const r = await fetch("https://slack.com/api/chat.postMessage", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify({ channel, text: `<!channel> ${line}\nCall them from ${SFB_PHONE_DISPLAY} within 5 minutes.` }) });
      const j = (await r.json()) as { ok: boolean; error?: string }; results.slack = j.ok ? "sent" : `error:${j.error}`;
    } else results.slack = "not_connected";
  } catch (e) { results.slack = `error:${e instanceof Error ? e.message : "unknown"}`; }
  // Email every owner.
  for (const o of owners ?? []) { if (!o.email) continue; const r = await sendEmail({ to: o.email, subject: `CALL NOW: ${call.name} is free right now (${call.phone})`, html: `<p><strong>${esc(call.name)}</strong> booked a demo and said they're free right now.</p><p>Call <strong>${esc(call.phone)}</strong> from ${SFB_PHONE_DISPLAY} within 5 minutes.</p><p>${esc(call.email)}${call.website ? ` · ${esc(call.website)}` : ""}<br/>Scheduled slot: ${fmtET(call.start_at)}${call.meet_url ? `<br/>Meet: ${call.meet_url}` : ""}</p>`, text: `${call.name} is free right now. Call ${call.phone} from ${SFB_PHONE_DISPLAY} within 5 minutes. ${call.email}. Slot ${fmtET(call.start_at)}.` }); results[`email:${o.email}`] = r.sent ? "sent" : `error:${r.error ?? r.skipped}`; }
  await service.from("demo_calls").update({ call_now_notified_at: new Date().toISOString(), call_now_notify_result: results }).eq("id", call.id);
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const icsEsc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
const icsDate = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

/** RFC 5545 event for Apple / Outlook / anything. */
export function icsFor(call: Pick<DemoCall, "id" | "start_at" | "end_at" | "meet_url" | "name">, origin: string): string {
  const desc = `SFB Connect demo call with ${call.name}.${call.meet_url ? ` Join: ${call.meet_url}` : ""} Save ${SFB_PHONE_DISPLAY} as ${SFB_CONTACT_NAME} so you know it's us when we call.`;
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//SFB Connect//Demo call//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "BEGIN:VEVENT", `UID:demo-${call.id}@sfbconnect.com`, `DTSTAMP:${icsDate(new Date().toISOString())}`, `DTSTART:${icsDate(call.start_at)}`, `DTEND:${icsDate(call.end_at)}`, `SUMMARY:${icsEsc("SFB Connect demo call")}`, `DESCRIPTION:${icsEsc(desc)}`, ...(call.meet_url ? [`LOCATION:${icsEsc(call.meet_url)}`, `URL:${call.meet_url}`] : []), `ORGANIZER;CN=SFB Connect:mailto:hello@sfbconnect.com`, "STATUS:CONFIRMED", "BEGIN:VALARM", "TRIGGER:-PT10M", "ACTION:DISPLAY", "DESCRIPTION:SFB Connect demo in 10 minutes", "END:VALARM", "END:VEVENT", "END:VCALENDAR"].join("\r\n") + "\r\n";
}

/** Links for the confirmation screen. Google/Outlook web links; Apple uses the .ics. */
export function calendarLinks(call: Pick<DemoCall, "id" | "start_at" | "end_at" | "meet_url">, origin: string) {
  const text = encodeURIComponent("SFB Connect demo call"); const details = encodeURIComponent(`${call.meet_url ? `Join: ${call.meet_url}\n` : ""}Save ${SFB_PHONE_DISPLAY} as ${SFB_CONTACT_NAME}.`);
  const dates = `${icsDate(call.start_at)}/${icsDate(call.end_at)}`;
  return {
    google: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dates}&details=${details}${call.meet_url ? `&location=${encodeURIComponent(call.meet_url)}` : ""}`,
    outlook: `https://outlook.live.com/calendar/0/action/compose?rru=addevent&subject=${text}&startdt=${encodeURIComponent(call.start_at)}&enddt=${encodeURIComponent(call.end_at)}&body=${details}${call.meet_url ? `&location=${encodeURIComponent(call.meet_url)}` : ""}`,
    ics: `${origin}/api/demo-call/${call.id}/ics`,
    vcard: `${origin}/api/contact-card`,
  };
}

/** vCard 3.0 — the "save our number" card. */
export function vcard(): string {
  return ["BEGIN:VCARD", "VERSION:3.0", `FN:${SFB_CONTACT_NAME}`, `N:${SFB_CONTACT_NAME};;;;`, `ORG:${SFB_CONTACT_NAME}`, `TEL;TYPE=CELL,VOICE:${SFB_PHONE_E164}`, "EMAIL;TYPE=INTERNET:hello@sfbconnect.com", "URL:https://www.sfbconnect.com", "NOTE:Save this so you know it's us when we call.", "END:VCARD"].join("\r\n") + "\r\n";
}

function confirmationEmail(call: DemoCall, origin: string) {
  const l = calendarLinks(call, origin); const when = fmtET(call.start_at);
  const html = `<!doctype html><html><body style="margin:0;background:#000;color:#f5f5f7;font-family:Inter,Helvetica,Arial,sans-serif"><div style="max-width:560px;margin:0 auto;padding:40px 24px"><div style="font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#8a8a8f">SFB Connect</div><h1 style="font-size:22px;margin:16px 0 12px;letter-spacing:-.02em">You're booked — ${esc(when)}</h1><div style="font-size:15px;line-height:1.6;color:#c9c9ce"><p>${call.call_now ? `<strong>${CALLBACK_PROMISE}</strong> Keep your phone close.</p><p>` : ""}Your demo call is on the calendar for <strong>${esc(when)}</strong> (all times Eastern).${call.meet_url ? ` Join here: <a style="color:#f5f5f7" href="${call.meet_url}">${call.meet_url}</a>` : ""}</p><p>Add it to your calendar: <a style="color:#f5f5f7" href="${l.google}">Google</a> · <a style="color:#f5f5f7" href="${l.ics}">Apple</a> · <a style="color:#f5f5f7" href="${l.outlook}">Outlook</a> (the .ics is attached too).</p><p><strong>Save ${SFB_PHONE_DISPLAY} as ${SFB_CONTACT_NAME}</strong> so you know it's us when we call — <a style="color:#f5f5f7" href="${l.vcard}">download the contact card</a>.</p></div></div></body></html>`;
  const text = `You're booked: ${when} (Eastern).${call.call_now ? ` ${CALLBACK_PROMISE}` : ""}${call.meet_url ? ` Join: ${call.meet_url}.` : ""} Add to calendar: Google ${l.google} · Apple ${l.ics} · Outlook ${l.outlook}. Save ${SFB_PHONE_DISPLAY} as ${SFB_CONTACT_NAME}: ${l.vcard}`;
  return { html, text };
}
