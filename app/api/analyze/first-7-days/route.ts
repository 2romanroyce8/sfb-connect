import { type NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/agent/store";
import { normalizeInput, readCache, replayScan, runScan, writeCache } from "@/lib/analyzer/run";
import type { ScanEvent } from "@/lib/analyzer/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Public, no login. POST { query } → NDJSON stream of ScanEvents (meta,
 * finding×5, done). Public data only; cached per domain for 24h; rate
 * limited per IP. Errors are events too, so the client always gets a reason.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { query?: string };
  const norm = normalizeInput(body.query ?? "");
  const encoder = new TextEncoder();
  const line = (e: ScanEvent) => encoder.encode(JSON.stringify(e) + "\n");

  if (!norm) {
    return new Response(line({ type: "error", code: "needs_link", message: "Enter your website address (or a social profile link) so we can read public data about your business." }), { status: 200, headers: { "content-type": "application/x-ndjson" } });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await rateLimit(`analyzer:${ip}:1h`, 12, 3600);
  if (!rl.allowed) {
    return new Response(line({ type: "error", code: "rate_limited", message: "That's a lot of scans from this network — try again in an hour." }), { status: 200, headers: { "content-type": "application/x-ndjson" } });
  }

  const service = createSupabaseServiceClient();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (e: ScanEvent) => controller.enqueue(line(e));
      try {
        const cached = await readCache(service, norm.domain).catch(() => null);
        if (cached) { replayScan(cached, emit); controller.close(); return; }
        const scan = await runScan({ ...norm, enteredQuery: (body.query ?? "").trim().slice(0, 200) }, emit);
        if (scan) await writeCache(service, norm.domain, scan).catch((e) => console.error("[analyzer] cache write failed:", e instanceof Error ? e.message : e));
      } catch (e) {
        console.error("[analyzer] scan failed:", e instanceof Error ? e.message : e);
        emit({ type: "error", code: "failed", message: "The scan hit an error on our side. Nothing was invented — try again in a moment." });
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson", "cache-control": "no-store" } });
}
