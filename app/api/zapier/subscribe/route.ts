import { NextRequest, NextResponse } from "next/server";
import { authenticateZapierKey, subscribe, unsubscribe, ZAPIER_EVENTS } from "@/lib/integrations/zapier";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** REST Hooks: POST {event, target_url} → {id}; DELETE ?id= removes. */
export async function POST(req: NextRequest) {
  const k = await authenticateZapierKey(req.headers.get("x-api-key"));
  if (!k) return NextResponse.json({ error: "invalid_api_key" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { event?: string; target_url?: string; hookUrl?: string };
  const target = body.target_url || body.hookUrl;
  if (!body.event || !target) return NextResponse.json({ error: "event and target_url are required", events: ZAPIER_EVENTS }, { status: 400 });
  try { const id = await subscribe(k.id, body.event, target); return NextResponse.json({ id }, { status: 201 }); }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "subscribe failed" }, { status: 400 }); }
}

export async function DELETE(req: NextRequest) {
  const k = await authenticateZapierKey(req.headers.get("x-api-key"));
  if (!k) return NextResponse.json({ error: "invalid_api_key" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id") || ((await req.json().catch(() => ({}))) as { id?: string }).id;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "id required" }, { status: 400 });
  await unsubscribe(k.id, id);
  return NextResponse.json({ ok: true });
}
