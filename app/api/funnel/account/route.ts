import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import crypto from "node:crypto";
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
  const cid = crypto.randomBytes(6).toString("hex"); // correlation id: in every log line and in the client error, never internals
  let stage = "create";
  try {
    const { userId } = await createAccount(createSupabaseServiceClient(), parsed);
    // Sign the visitor in HERE (cookies set on this response) so success is atomic: account + session + next step.
    stage = "sign_in";
    const { error: sErr } = await createSupabaseServerClient().auth.signInWithPassword({ email: parsed.email, password: parsed.password });
    if (sErr) {
      console.error(`[funnel-account cid=${cid}] stage=sign_in user=${userId} error=${sErr.message}`);
      // Account exists and the code was sent; the browser retries sign-in itself and, failing that, shows a retry-safe message.
      return NextResponse.json({ ok: true, email: parsed.email, signedIn: false, cid });
    }
    console.log(`[funnel-account cid=${cid}] stage=done user=${userId} signed_in=true`);
    return NextResponse.json({ ok: true, email: parsed.email, signedIn: true, cid });
  } catch (e) {
    if (e instanceof FunnelError) { console.warn(`[funnel-account cid=${cid}] stage=${stage} funnel_error=${e.code}`); return NextResponse.json({ error: e.message, code: e.code, signIn: e.code === "exists", cid }, { status: e.status }); }
    console.error(`[funnel-account cid=${cid}] stage=${stage} error=${e instanceof Error ? e.message : String(e)}`);
    return NextResponse.json({ error: `Something failed on our side. It was logged (ref ${cid}) — please try again.`, cid }, { status: 500 });
  }
}
