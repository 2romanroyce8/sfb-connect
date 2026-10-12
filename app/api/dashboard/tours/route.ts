import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { TOURS } from "@/lib/tours/definitions";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** My tour state for every tour (so the client knows what to auto-start and what's been turned off). */
export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { data } = await supabase.from("user_tour_state").select("tour_key, status, last_step, dont_show, times_started").eq("user_id", user.id);
  return NextResponse.json({ state: Object.fromEntries((data ?? []).map((r) => [r.tour_key, r])) });
}

/**
 * {tour, action: started|step|step_skipped|completed|skipped|dont_show, step?, sessionId, device, dontShow?}
 * Writes the per-user state (service role, caller's own row only) and one analytics row with no PII.
 */
export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { tour?: string; action?: string; step?: number; sessionId?: string; device?: string; dontShow?: boolean };
  if (!b.tour || !TOURS[b.tour]) return NextResponse.json({ error: "Unknown tour." }, { status: 400 });
  const action = b.action ?? "";
  if (!["started", "step", "step_skipped", "completed", "skipped", "dont_show"].includes(action)) return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  const service = createSupabaseServiceClient();
  const step = Number.isInteger(b.step) ? (b.step as number) : null;
  const device = b.device === "mobile" ? "mobile" : "desktop";
  const sessionId = typeof b.sessionId === "string" && /^[0-9a-f-]{36}$/i.test(b.sessionId) ? b.sessionId : null;
  if (sessionId) await service.from("tour_events").insert({ tour_key: b.tour, session_id: sessionId, event: action, step_index: step, device });

  const { data: cur } = await service.from("user_tour_state").select("times_started, dont_show, status").eq("user_id", user.id).eq("tour_key", b.tour).maybeSingle();
  const patch: Record<string, unknown> = { user_id: user.id, tour_key: b.tour, updated_at: new Date().toISOString() };
  if (action === "started") { patch.status = "started"; patch.last_step = 0; patch.times_started = ((cur?.times_started as number) ?? 0) + 1; patch.dont_show = cur?.dont_show ?? false; }
  if (action === "step" || action === "step_skipped") { if (step != null) patch.last_step = step; }
  if (action === "completed") patch.status = "completed";
  if (action === "skipped") { patch.status = "skipped"; if (step != null) patch.last_step = step; }
  if (action === "dont_show" || typeof b.dontShow === "boolean") patch.dont_show = b.dontShow ?? true;
  if (!cur && !("status" in patch)) patch.status = "started";
  const { error } = await service.from("user_tour_state").upsert(patch, { onConflict: "user_id,tour_key" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
