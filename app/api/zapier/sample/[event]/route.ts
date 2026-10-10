import { NextRequest, NextResponse } from "next/server";
import { authenticateZapierKey, ZAPIER_SAMPLES } from "@/lib/integrations/zapier";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Zapier "perform_list": sample rows for the editor. Always an array. */
export async function GET(req: NextRequest, { params }: { params: { event: string } }) {
  const k = await authenticateZapierKey(req.headers.get("x-api-key"));
  if (!k) return NextResponse.json({ error: "invalid_api_key" }, { status: 401 });
  const sample = ZAPIER_SAMPLES[params.event];
  if (!sample) return NextResponse.json({ error: "unknown_event", events: Object.keys(ZAPIER_SAMPLES) }, { status: 404 });
  return NextResponse.json([sample]);
}
