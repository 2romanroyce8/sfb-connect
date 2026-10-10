import { NextRequest, NextResponse } from "next/server";
import { authenticateZapierKey } from "@/lib/integrations/zapier";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Zapier "test auth" endpoint: X-API-Key header → 200 with a label, else 401. */
export async function GET(req: NextRequest) {
  const k = await authenticateZapierKey(req.headers.get("x-api-key"));
  if (!k) return NextResponse.json({ error: "invalid_api_key" }, { status: 401 });
  return NextResponse.json({ ok: true, account: "SFB Connect", key_id: k.id });
}
