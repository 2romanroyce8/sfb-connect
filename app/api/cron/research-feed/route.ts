import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { runFeed } from "@/lib/research/feed/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // works on every Vercel plan; the run self-bounds at 45s

/**
 * Nightly prospect feed trigger. Called by pg_cron (via pg_net) with the
 * Vault-held token as a Bearer header; the DB stores only the token's
 * SHA-256 and so do we. CRON_SECRET (Vercel cron convention) is accepted as
 * an alternative if it is ever set. Anything else is 401 and does nothing.
 */
export async function POST(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const service = createSupabaseServiceClient();
  const { data: settings } = await service.from("research_feed_settings").select("enabled, cron_token_hash").eq("id", 1).maybeSingle();
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  const expected = (settings as { cron_token_hash: string | null } | null)?.cron_token_hash ?? null;
  const okDb = !!expected && expected.length === hash.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(hash));
  const okEnv = !!process.env.CRON_SECRET && process.env.CRON_SECRET.length === token.length && crypto.timingSafeEqual(Buffer.from(process.env.CRON_SECRET), Buffer.from(token));
  if (!okDb && !okEnv) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (settings && (settings as { enabled: boolean }).enabled === false) return NextResponse.json({ skipped: "disabled" });

  const summary = await runFeed({ service, trigger: "cron", deadlineMs: 45_000 });
  return NextResponse.json(summary);
}

export async function GET() {
  return NextResponse.json({ error: "method_not_allowed" }, { status: 405 });
}
