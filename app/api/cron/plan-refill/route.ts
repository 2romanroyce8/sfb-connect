import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { refillAnnualPlans } from "@/lib/agentProgram/provision";
import { alertOwners } from "@/lib/notify/ownerAlerts";
import { refreshContentLab } from "@/lib/contentLab/refresh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily credit refill for ANNUAL plans (Stripe invoices them yearly, so
 * invoice.paid can't drive the monthly allotment). Called by pg_cron via
 * pg_net with the Vault-held token (billing_cron_settings.cron_token_hash is
 * its SHA-256); CRON_SECRET accepted as an alternative. Idempotent.
 */
export async function POST(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const service = createSupabaseServiceClient();
  const { data: settings } = await service.from("billing_cron_settings").select("enabled, cron_token_hash").eq("id", 1).maybeSingle();
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  const expected = (settings as { cron_token_hash: string | null } | null)?.cron_token_hash ?? null;
  const okDb = !!expected && expected.length === hash.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(hash));
  const okEnv = !!process.env.CRON_SECRET && process.env.CRON_SECRET.length === token.length && crypto.timingSafeEqual(Buffer.from(process.env.CRON_SECRET), Buffer.from(token));
  if (!okDb && !okEnv) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (settings && (settings as { enabled: boolean }).enabled === false) return NextResponse.json({ skipped: "disabled" });

  const summary = await refillAnnualPlans(service);
  // G12 watchdog (2026-10-12): the hourly outbound sync cannot report its own absence; this daily job checks it ran in the last 2 hours.
  let outboundSync: "ok" | "stale" | "disabled" | "unknown" = "unknown";
  try {
    const { data: os } = await service.from("outbound_cron_settings").select("enabled, last_run_at").eq("id", 1).maybeSingle();
    if (os && os.enabled === false) outboundSync = "disabled";
    else if (os?.last_run_at && Date.now() - new Date(os.last_run_at as string).getTime() > 2 * 3600e3) {
      outboundSync = "stale";
      const since = new Date(os.last_run_at as string).toISOString();
      await alertOwners(service, { trigger: "system_health", sms: `Hourly outbound sync has NOT run since ${since}. Replies and follow-ups are not being processed.`, email: { subject: "Hourly outbound sync has stalled", html: `<p>The hourly outbound sync last ran at <strong>${since}</strong>. Replies, follow-ups, retries and reminders are not being processed. Check <code>cron.job_run_details</code> for <code>outbound-sync-hourly</code> and the Vault token.</p>`, text: `Hourly outbound sync last ran ${since}. Check cron.job_run_details.` }, inApp: { type: "system", title: "Hourly outbound sync has stalled", body: `Last run ${since}`, actionUrl: "/team/outbound", actionLabel: "Outbound" }, detail: { last_run_at: since } });
    } else if (os?.last_run_at) outboundSync = "ok";
  } catch (e) { console.error("[plan-refill] outbound watchdog failed:", e instanceof Error ? e.message : e); }
  await service.from("billing_cron_settings").update({ last_run_at: new Date().toISOString(), last_result: summary, updated_at: new Date().toISOString() }).eq("id", 1);
  // Content Lab Trend Radar: daily refresh rides on this daily job (read-only Instagram pulls).
  let contentLab: string = "skipped";
  try { const r = await refreshContentLab(service); contentLab = `${r.status}:${r.fetched}`; } catch (e) { contentLab = `error:${e instanceof Error ? e.message.slice(0, 80) : "err"}`; }
  return NextResponse.json({ ...summary, outboundSync, contentLab });
}

export async function GET() {
  return NextResponse.json({ error: "method_not_allowed" }, { status: 405 });
}
