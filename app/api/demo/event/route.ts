import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/agent/store";
import { getPublicDemo } from "@/lib/agency/demoPublic";
export const dynamic = "force-dynamic";

// Public demo analytics. Only these events exist; the demo must be published; no cookies, no IP address and no visitor text are stored.
// A session is an anonymous random id created per browser tab. Rate-limited per IP (the IP is used only for the limit and is not saved).
const EVENTS = new Set(["demo_opened", "session_started", "chat_started", "voice_started", "audit_requested", "cta_clicked", "booking_requested", "lead_submitted"]);
export async function POST(req: NextRequest) {
  const b = (await req.json().catch(() => ({}))) as { agency?: string; slug?: string; event?: string; session?: string };
  if (typeof b.event !== "string" || !EVENTS.has(b.event) || typeof b.agency !== "string" || typeof b.slug !== "string") return NextResponse.json({ ok: false }, { status: 400 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!(await rateLimit(`demoevt:${ip}:10m`, 60, 600)).allowed) return NextResponse.json({ ok: false }, { status: 429 });
  const demo = await getPublicDemo(b.agency, b.slug); if (!demo) return NextResponse.json({ ok: false }, { status: 404 });
  const db = createSupabaseServiceClient();
  let sessionId: string | null = typeof b.session === "string" && /^[0-9a-f-]{36}$/i.test(b.session) ? b.session : null;
  if (b.event === "session_started" || (b.event === "demo_opened" && !sessionId)) {
    const { data } = await db.from("agy_demo_sessions").insert({ demo_id: demo.id, agency_id: demo.agencyId, consented: true }).select("id").single();
    sessionId = (data?.id as string) ?? null;
  } else if (sessionId) {
    const { data: s } = await db.from("agy_demo_sessions").select("id").eq("id", sessionId).eq("demo_id", demo.id).maybeSingle(); if (!s) sessionId = null; // never trust a client-supplied id
  }
  await db.from("agy_demo_events").insert({ demo_id: demo.id, agency_id: demo.agencyId, session_id: sessionId, event: b.event });
  if (b.event === "demo_opened") {
    // A lead this demo was sent to moves to Demo Viewed (only from the early stages, so it never drags a later deal backwards) and the history says why.
    const { data: moved } = await db.from("agy_leads").update({ stage: "demo_viewed", updated_at: new Date().toISOString() }).eq("agency_id", demo.agencyId).eq("demo_id", demo.id).in("stage", ["new_lead", "contacted", "qualified", "demo_sent"]).select("id");
    if (moved?.length) await db.from("agy_lead_activities").insert(moved.map((l) => ({ agency_id: demo.agencyId, lead_id: l.id as string, kind: "demo_viewed", body: "The prospect opened the demo link." })));
  }
  return NextResponse.json({ ok: true, session: sessionId });
}
