import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/agent/store";
import { appOrigin } from "@/lib/agent/auth";
import { bookDemoCall, parseDemoCallInput, calendarLinks, DemoCallError, CALLBACK_PROMISE, fmtET } from "@/lib/demoCall/booking";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await rateLimit(`demo-call:${ip}:1d`, 5, 86400);
  if (!rl.allowed) return NextResponse.json({ error: "Too many bookings from this network today." }, { status: 429 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = parseDemoCallInput(b);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { data: { user } } = await createSupabaseServerClient().auth.getUser();
  try {
    const call = await bookDemoCall(createSupabaseServiceClient(), { ...parsed, signupUserId: user?.id ?? null }, appOrigin(req));
    return NextResponse.json({ ok: true, call: { id: call.id, start_at: call.start_at, end_at: call.end_at, meet_url: call.meet_url, when: fmtET(call.start_at), call_now: call.call_now }, links: calendarLinks(call, appOrigin(req)), promise: call.call_now ? CALLBACK_PROMISE() : null });
  } catch (e) {
    if (e instanceof DemoCallError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    console.error("[demo-call]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Booking failed on our side. It was logged — please try again." }, { status: 500 });
  }
}
