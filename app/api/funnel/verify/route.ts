import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/agent/store";
import { getSignup, verifySignup } from "@/lib/funnel/signup";
import { issueCode } from "@/lib/demo/verification";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function me() { const { data: { user } } = await createSupabaseServerClient().auth.getUser(); return user; }

/** Step 2 — POST {code}. PUT = resend (60 s cooldown, 3 resends). Session-gated: the signed-in user verifies their own email. */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await rateLimit(`funnel-verify:${ip}:1h`, 40, 3600);
  if (!rl.allowed) return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  const user = await me(); if (!user) return NextResponse.json({ error: "Sign in to continue.", restart: true }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { code?: string };
  const code = (b.code ?? "").replace(/\D/g, ""); if (code.length !== 6) return NextResponse.json({ error: "Enter the 6-digit code." }, { status: 400 });
  const v = await verifySignup(createSupabaseServiceClient(), user.id, code);
  if (!v.ok) {
    const msg = v.reason === "expired" ? "That code expired. Send a new one." : v.reason === "too_many_attempts" ? "Too many wrong codes. Send a new one." : v.reason === "no_code" ? "No code is active. Send a new one." : v.reason === "no_signup" ? "Start by creating your account." : "That code isn't right.";
    return NextResponse.json({ error: msg, reason: v.reason }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

export async function PUT() {
  const user = await me(); if (!user?.email) return NextResponse.json({ error: "Sign in to continue.", restart: true }, { status: 401 });
  const db = createSupabaseServiceClient();
  const s = await getSignup(db, user.id); if (!s) return NextResponse.json({ error: "Start by creating your account.", restart: true }, { status: 404 });
  if (s.email_verified_at) return NextResponse.json({ ok: true, already: true });
  const r = await issueCode(db, user.id, s.email, null, { isResend: true });
  if (!r.ok) return NextResponse.json({ error: r.reason === "cooldown" ? `Wait ${r.retryInSec}s before resending.` : r.reason === "max_resends" ? "Resend limit reached. Check spam, or start again with the right email." : "We couldn't send the email just now.", reason: r.reason, retryInSec: r.retryInSec ?? null }, { status: r.reason === "send_failed" ? 502 : 429 });
  return NextResponse.json({ ok: true });
}
