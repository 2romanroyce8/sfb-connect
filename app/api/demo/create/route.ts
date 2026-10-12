import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/agent/store";
import { createDemoAccount, parseDemoProfile, DemoError } from "@/lib/demo/provision";
import { PENDING_COOKIE, signPending } from "@/lib/demo/verification";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Review screen → account + business (unverified) + first code. The pending
// identity goes into a signed, httpOnly cookie; the browser never holds ids.
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await rateLimit(`demo-create:${ip}:1d`, 6, 86400);
  if (!rl.allowed) return NextResponse.json({ error: "Too many signups from this network today." }, { status: 429 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Enter your work email." }, { status: 400 });
  const password = typeof b.password === "string" ? b.password : "";
  if (password.length < 8) return NextResponse.json({ error: "Create a password of at least 8 characters." }, { status: 400 });
  const parsed = parseDemoProfile(b);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const buildId = typeof b.buildId === "string" && /^[0-9a-f-]{36}$/.test(b.buildId) ? b.buildId : null;
  const service = createSupabaseServiceClient();
  try {
    // The build row must belong to this email if supplied (no claiming someone else's build).
    if (buildId) { const { data } = await service.from("demo_builds").select("email").eq("id", buildId).maybeSingle(); if (!data || data.email !== email) return NextResponse.json({ error: "That build doesn't match this email — start again." }, { status: 400 }); }
    const r = await createDemoAccount(service, { email, password, buildId, profile: parsed.profile });
    const res = NextResponse.json({ ok: true, email });
    res.cookies.set(PENDING_COOKIE, signPending({ userId: r.userId, email, businessId: r.businessId }), { httpOnly: true, secure: true, sameSite: "lax", maxAge: 24 * 3600, path: "/" });
    return res;
  } catch (e) {
    if (e instanceof DemoError) return NextResponse.json({ error: e.message, code: e.code, signIn: e.code === "exists" }, { status: e.status });
    console.error("[demo-create]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Something failed on our side. It was logged — please try again." }, { status: 500 });
  }
}
