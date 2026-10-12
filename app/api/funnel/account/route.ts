import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/agent/store";
import { createAccount, parseAccountInput, FunnelError } from "@/lib/funnel/signup";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Step 1 — name, email, phone, website, password. No price anywhere on this path. */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await rateLimit(`funnel-account:${ip}:1d`, 8, 86400);
  if (!rl.allowed) return NextResponse.json({ error: "Too many signups from this network today." }, { status: 429 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = parseAccountInput(b);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    await createAccount(createSupabaseServiceClient(), parsed);
    // The browser signs in with the password it just chose (client-side); the next step is gated by the session.
    return NextResponse.json({ ok: true, email: parsed.email });
  } catch (e) {
    if (e instanceof FunnelError) return NextResponse.json({ error: e.message, code: e.code, signIn: e.code === "exists" }, { status: e.status });
    console.error("[funnel-account]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Something failed on our side. It was logged — please try again." }, { status: 500 });
  }
}
