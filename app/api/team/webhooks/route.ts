import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/team/requireOwner";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { createEndpoint, deleteEndpoint, emitWebhook, WEBHOOK_EVENTS } from "@/lib/integrations/webhooks";
import { markProviderVerified } from "@/lib/integrations/connections";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Owner: list endpoints + last deliveries. */
export async function GET() {
  const g = await requireOwner(); if ("error" in g) return g.error;
  const s = createSupabaseServiceClient();
  const [{ data: endpoints }, { data: deliveries }] = await Promise.all([
    s.from("webhook_endpoints").select("id, url, events, description, active, failure_count, last_delivery_at, created_at").order("created_at", { ascending: false }),
    s.from("webhook_deliveries").select("id, endpoint_id, event, status_code, ok, error, duration_ms, created_at").order("created_at", { ascending: false }).limit(30),
  ]);
  return NextResponse.json({ endpoints: endpoints ?? [], deliveries: deliveries ?? [], events: WEBHOOK_EVENTS });
}

/** Owner: create an endpoint (secret returned once) or send a test event. */
export async function POST(req: NextRequest) {
  const g = await requireOwner(); if ("error" in g) return g.error;
  const body = (await req.json().catch(() => ({}))) as { action?: "create" | "test"; url?: string; events?: string[]; description?: string };
  if (body.action === "test") {
    const r = await emitWebhook("webhook.test", { message: "Hello from SFB Connect", sent_by: g.email });
    if (r.delivered > 0) await markProviderVerified("webhooks");
    return NextResponse.json(r);
  }
  if (!body.url) return NextResponse.json({ error: "url required" }, { status: 400 });
  try { return NextResponse.json(await createEndpoint(g.userId, { url: body.url, events: body.events, description: body.description }), { status: 201 }); }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "create failed" }, { status: 400 }); }
}

export async function DELETE(req: NextRequest) {
  const g = await requireOwner(); if ("error" in g) return g.error;
  const id = req.nextUrl.searchParams.get("id");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "id required" }, { status: 400 });
  await deleteEndpoint(id);
  return NextResponse.json({ ok: true });
}
