import { NextResponse, type NextRequest } from "next/server";
import { rateLimit } from "@/lib/agent/store";
import { fetchHtml, AuditFetchError } from "@/lib/mk/safeFetch";
import { auditHtml, summarize } from "@/lib/mk/audit";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Public website audit. Reads ONE public page per request through the SSRF-guarded fetcher and reports only what the HTML actually contains.
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await rateLimit(`auditdemo:${ip}:1h`, 12, 3600);
  if (!rl.allowed) return NextResponse.json({ error: "You've reached the hourly limit for website audits. Try again later." }, { status: 429 });
  const body = (await req.json().catch(() => ({}))) as { url?: unknown };
  if (typeof body.url !== "string" || body.url.length > 300) return NextResponse.json({ error: "Enter a website address." }, { status: 400 });
  try {
    const page = await fetchHtml(body.url);
    const checks = auditHtml(page.html, page.finalUrl.toString());
    return NextResponse.json({ url: page.finalUrl.toString(), status: page.status, fetchedMs: page.ms, truncated: page.truncated, summary: summarize(checks), checks, note: "Based on the HTML the site returned. No JavaScript was run, so sites built entirely in the browser may show fewer signals." });
  } catch (e) {
    if (e instanceof AuditFetchError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[audit]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "We couldn't audit that site. Please try another address." }, { status: 502 });
  }
}
