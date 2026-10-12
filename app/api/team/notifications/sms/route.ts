import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { resendConfigured } from "@/lib/email/resend";
import { CARRIERS, CONFIGURABLE_TRIGGERS, normalizePhone, carrier, decideChannels, type NotifyUser } from "@/lib/notify/sms";
import { sendGatewaySms } from "@/lib/notify/ownerAlerts";
import { notify } from "@/lib/crm/notify";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLS = "id, email, notify_phone, notify_carrier, notify_prefs, notify_sms_verified_at, notify_sms_last_bounce_at, notify_sms_last_bounce_reason";

async function me() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("users").select(COLS).eq("id", user.id).single();
  return data as (NotifyUser & { notify_sms_last_bounce_reason: string | null }) | null;
}

/** My text-alert settings, the carrier table, and my last 15 deliveries. */
export async function GET() {
  const u = await me(); if (!u) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { data: deliveries } = await createSupabaseServerClient().from("notification_deliveries").select("id, trigger, channel, to_address, body, status, reason, provider_last_event, created_at").eq("user_id", u.id).order("created_at", { ascending: false }).limit(15);
  return NextResponse.json({ settings: u, carriers: CARRIERS, triggers: CONFIGURABLE_TRIGGERS, deliveries: deliveries ?? [], resendConfigured: resendConfigured() });
}

/**
 * action=save   {phone, carrier, prefs}          — validated server-side; changing the phone or carrier clears verification + bounce state.
 * action=test   {}                                — sends a real test text to MY number, then polls Resend for ~12 s and reports what Resend saw.
 * action=verify {}                                — "I received it": marks SMS verified (alerts go SMS-only from here; call-now still also emails).
 */
export async function POST(req: NextRequest) {
  const u = await me(); if (!u) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { action?: string; phone?: string; carrier?: string; prefs?: Record<string, unknown> };
  const service = createSupabaseServiceClient();

  if (body.action === "save") {
    const phone = body.phone ? normalizePhone(body.phone) : null;
    if (body.phone && !phone) return NextResponse.json({ error: "Enter a 10-digit US mobile number." }, { status: 400 });
    const c = body.carrier ? carrier(body.carrier) : null;
    if (body.carrier && !c) return NextResponse.json({ error: "Pick a carrier from the list." }, { status: 400 });
    const prefs: Record<string, boolean> = {};
    for (const t of CONFIGURABLE_TRIGGERS) if (typeof body.prefs?.[t.key] === "boolean") prefs[t.key] = body.prefs![t.key] as boolean;
    const changed = phone !== u.notify_phone || (c?.key ?? null) !== u.notify_carrier;
    const patch: Record<string, unknown> = { notify_phone: phone, notify_carrier: c?.key ?? null, notify_prefs: { ...(u.notify_prefs ?? {}), ...prefs } };
    if (changed) Object.assign(patch, { notify_sms_verified_at: null, notify_sms_last_bounce_at: null, notify_sms_last_bounce_reason: null });
    const { error } = await service.from("users").update(patch).eq("id", u.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, changed, gateway: phone && c?.gateway ? `${phone}@${c.gateway}` : null, carrier: c });
  }

  if (body.action === "test") {
    const d = decideChannels(u, "sms_test");
    if (!d.gateway) return NextResponse.json({ error: d.smsSkipReason === "no_phone" ? "Save your mobile number first." : d.smsSkipReason === "no_carrier" ? "Pick your carrier first." : d.smsSkipReason === "carrier_shutdown" ? `${carrier(u.notify_carrier)?.label} shut its email-to-text gateway down — alerts for you go to email.` : d.smsSkipReason === "recent_bounce" ? "Your carrier bounced the last text; alerts are going to email for 7 days. Change the carrier or number to try again." : "No text gateway for this line — alerts go to email.", reason: d.smsSkipReason }, { status: 400 });
    const stamp = new Date().toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" });
    const r = await sendGatewaySms(service, u, "sms_test", d.gateway, `SFB Connect test text ${stamp} ET. Reply not needed. Tap "I received it" in Settings.`, { test: true });
    if (r.status !== "sent") return NextResponse.json({ error: `Resend refused the message: ${r.reason}`, gateway: d.gateway }, { status: 502 });
    // Poll Resend for the gateway's verdict (delivered = handed to the carrier; bounced = gateway dead for this line).
    let lastEvent: string | null = null;
    if (resendConfigured() && r.providerIds[0]) {
      const resend = new Resend(process.env.RESEND_API_KEY!.trim());
      const deadline = Date.now() + 12_000;
      while (Date.now() < deadline) {
        try { const g = await resend.emails.get(r.providerIds[0]); lastEvent = g.data?.last_event ?? null; } catch { /* keep polling */ }
        if (lastEvent && lastEvent !== "queued" && lastEvent !== "scheduled") break;
        await new Promise((res) => setTimeout(res, 2000));
      }
      await service.from("notification_deliveries").update({ provider_last_event: lastEvent, provider_checked_at: new Date().toISOString() }).eq("provider_id", r.providerIds[0]);
      if (lastEvent === "bounced" || lastEvent === "complained") await service.from("users").update({ notify_sms_last_bounce_at: new Date().toISOString(), notify_sms_last_bounce_reason: lastEvent }).eq("id", u.id);
    }
    await notify(service, { userId: u.id, type: "sms_test", title: "Test text sent", body: `To ${d.gateway}. Resend: ${lastEvent ?? "no event yet"}.` });
    return NextResponse.json({ ok: true, gateway: d.gateway, providerId: r.providerIds[0] ?? null, lastEvent, sentAt: new Date().toISOString() });
  }

  if (body.action === "verify") {
    const { error } = await service.from("users").update({ notify_sms_verified_at: new Date().toISOString(), notify_sms_last_bounce_at: null, notify_sms_last_bounce_reason: null }).eq("id", u.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
