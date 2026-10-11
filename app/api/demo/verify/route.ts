import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/agent/store";
import { activateDemo, DemoError } from "@/lib/demo/provision";
import { PENDING_COOKIE, readPending, verifyCode, issueCode } from "@/lib/demo/verification";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pendingOr401 = (req: NextRequest) => readPending(req.cookies.get(PENDING_COOKIE)?.value);

/** POST {code} → verifies, activates (clock + credits), signs the browser in, clears the pending cookie. */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await rateLimit(`demo-verify:${ip}:1h`, 40, 3600);
  if (!rl.allowed) return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  const pending = pendingOr401(req);
  if (!pending) return NextResponse.json({ error: "Your signup session expired — start again.", restart: true }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { code?: string };
  const code = (b.code ?? "").replace(/\D/g, "");
  if (code.length !== 6) return NextResponse.json({ error: "Enter the 6-digit code." }, { status: 400 });
  const service = createSupabaseServiceClient();
  const v = await verifyCode(service, pending.userId, code);
  if (!v.ok) {
    const msg = v.reason === "expired" ? "That code expired. Send a new one." : v.reason === "too_many_attempts" ? "Too many wrong codes. Send a new one." : v.reason === "no_code" ? "No code is active. Send a new one." : "That code isn't right.";
    return NextResponse.json({ error: msg, reason: v.reason }, { status: 400 });
  }
  try {
    const a = await activateDemo(service, pending);
    // Sign the browser in without a password: admin magic link → verifyOtp sets the session cookies on this response.
    const { data: link, error: lErr } = await service.auth.admin.generateLink({ type: "magiclink", email: pending.email });
    let signedIn = false;
    if (!lErr && link.properties?.hashed_token) {
      const { error: vErr } = await createSupabaseServerClient().auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "magiclink" });
      signedIn = !vErr; if (vErr) console.error("[demo-verify] sign-in failed", vErr.message);
    } else console.error("[demo-verify] magic link failed", lErr?.message);
    const res = NextResponse.json({ ok: true, expiresAt: a.expiresAt, signedIn, redirect: signedIn ? "/dashboard/agent?setup=gmail" : "/login?next=%2Fdashboard%2Fagent%3Fsetup%3Dgmail" });
    res.cookies.set(PENDING_COOKIE, "", { httpOnly: true, secure: true, sameSite: "lax", maxAge: 0, path: "/" });
    return res;
  } catch (e) {
    if (e instanceof DemoError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[demo-verify]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Verified, but activation failed on our side. It was logged — try again." }, { status: 500 });
  }
}

/** PUT → resend (60 s cooldown, 3 resends). */
export async function PUT(req: NextRequest) {
  const pending = pendingOr401(req);
  if (!pending) return NextResponse.json({ error: "Your signup session expired — start again.", restart: true }, { status: 401 });
  const service = createSupabaseServiceClient();
  const { data: biz } = await service.from("businesses").select("legal_name").eq("id", pending.businessId).maybeSingle();
  const r = await issueCode(service, pending.userId, pending.email, biz?.legal_name ?? null, { isResend: true });
  if (!r.ok) return NextResponse.json({ error: r.reason === "cooldown" ? `Wait ${r.retryInSec}s before resending.` : r.reason === "max_resends" ? "Resend limit reached. Check spam, or start again with the right email." : "We couldn't send the email just now.", reason: r.reason, retryInSec: r.retryInSec ?? null }, { status: r.reason === "send_failed" ? 502 : 429 });
  return NextResponse.json({ ok: true });
}
