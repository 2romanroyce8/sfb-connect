import { type NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/agent/store";
import { buildProfileFromSite, type BuildEvent } from "@/lib/demo/build";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// The build show: POST {url, email} → NDJSON stream of steps + facts, ending
// with {type:"done", facts, buildId}. Ungated by design (this is the hook);
// nothing is created except the demo_builds row that the review screen claims.
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await rateLimit(`demo-build:${ip}:1h`, 20, 3600);
  if (!rl.allowed) return NextResponse.json({ error: "Too many builds from this network. Try again in an hour." }, { status: 429 });
  const b = (await req.json().catch(() => ({}))) as { url?: string; email?: string };
  const url = (b.url ?? "").trim().slice(0, 300); const email = (b.email ?? "").trim().toLowerCase();
  if (url.length < 4) return NextResponse.json({ error: "Enter your website address." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Enter your work email." }, { status: 400 });

  const encoder = new TextEncoder();
  const service = createSupabaseServiceClient();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: unknown) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        const facts = await buildProfileFromSite(url, (e: BuildEvent) => { if (e.type !== "done") send(e); });
        if (facts && facts.reachable && !facts.parked) {
          const { data } = await service.from("demo_builds").insert({ email, url: facts.url, domain: facts.domain, facts, ip_hash: crypto.createHash("sha256").update(ip).digest("hex").slice(0, 24) }).select("id").single();
          send({ type: "done", facts, buildId: data?.id ?? null });
        } else if (facts) {
          send({ type: "done", facts, buildId: null });
        }
      } catch (e) {
        send({ type: "error", message: e instanceof Error ? e.message : "The build failed." });
      } finally { controller.close(); }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
}
