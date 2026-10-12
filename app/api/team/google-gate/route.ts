import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/team/requireOwner";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { gateOverview, markCleared, afterCountChange } from "@/lib/google/clearance";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Owner view: counter, block state, pending/cleared/connected rows, console link. */
export async function GET() {
  const gate = await requireOwner(); if ("error" in gate) return gate.error;
  return NextResponse.json(await gateOverview(createSupabaseServiceClient()));
}

/**
 * action=mark_cleared {businessId} — after adding the address in the Cloud Console.
 * action=set_block {blocked}       — manual cap guard.
 * action=recount                    — re-run threshold checks (used after a simulated test is reset).
 */
export async function POST(req: NextRequest) {
  const gate = await requireOwner(); if ("error" in gate) return gate.error;
  const body = (await req.json().catch(() => ({}))) as { action?: string; businessId?: string; blocked?: boolean };
  const service = createSupabaseServiceClient();
  if (body.action === "mark_cleared") {
    if (!body.businessId || !/^[0-9a-f-]{36}$/i.test(body.businessId)) return NextResponse.json({ error: "businessId required." }, { status: 400 });
    const r = await markCleared(service, body.businessId, gate.userId);
    if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 409 });
    return NextResponse.json({ ok: true, count: r.count, clearance: r.clearance });
  }
  if (body.action === "set_block") {
    await service.from("google_gate_state").update({ clearances_blocked: !!body.blocked, updated_at: new Date().toISOString() }).eq("id", 1);
    return NextResponse.json({ ok: true, blocked: !!body.blocked });
  }
  if (body.action === "recount") return NextResponse.json({ ok: true, count: await afterCountChange(service) });
  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
