import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { refillAnnualPlans } from "@/lib/agentProgram/provision";

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
  await service.from("billing_cron_settings").update({ last_run_at: new Date().toISOString(), last_result: summary, updated_at: new Date().toISOString() }).eq("id", 1);
  return NextResponse.json(summary);
}

export async function GET() {
  return NextResponse.json({ error: "method_not_allowed" }, { status: 405 });
}
