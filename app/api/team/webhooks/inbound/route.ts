import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/team/requireOwner";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { createInboundToken } from "@/lib/integrations/webhooks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Owner: create an inbound URL (token shown once) / list recent events / delete. */
export async function GET() {
  const g = await requireOwner(); if ("error" in g) return g.error;
  const s = createSupabaseServiceClient();
  const [{ data: tokens }, { data: events }] = await Promise.all([
    s.from("inbound_webhook_tokens").select("id, label, file_task, received_count, last_received_at, created_at").order("created_at", { ascending: false }),
    s.from("inbound_webhook_events").select("id, token_id, source_ip, payload, task_id, created_at").order("created_at", { ascending: false }).limit(20),
  ]);
  return NextResponse.json({ tokens: tokens ?? [], events: events ?? [] });
}

export async function POST(req: NextRequest) {
  const g = await requireOwner(); if ("error" in g) return g.error;
  const body = (await req.json().catch(() => ({}))) as { label?: string; fileTask?: boolean };
  if (!body.label) return NextResponse.json({ error: "label required" }, { status: 400 });
  return NextResponse.json(await createInboundToken(g.userId, body.label.slice(0, 80), body.fileTask !== false), { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const g = await requireOwner(); if ("error" in g) return g.error;
  const id = req.nextUrl.searchParams.get("id");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "id required" }, { status: 400 });
  await createSupabaseServiceClient().from("inbound_webhook_tokens").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
