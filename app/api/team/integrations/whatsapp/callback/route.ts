import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { markProviderVerified } from "@/lib/integrations/connections";
import { handleVerification, verifyMetaSignature } from "@/lib/integrations/whatsapp";
import { emitIntegrationEvent } from "@/lib/integrations/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Meta webhook for WhatsApp Business.
 * GET  — Meta's verification handshake. A correct verify token echoes the
 *        challenge AND marks the provider verified (the real test connection).
 * POST — inbound messages/status updates. Signature-checked with META_APP_SECRET
 *        when present; stored as inbound events and surfaced to the agent.
 */
export async function GET(req: NextRequest) {
  const v = handleVerification(req.nextUrl.searchParams);
  if (!v.ok) return new NextResponse(v.reason === "not_configured" ? "WhatsApp not configured" : "Forbidden", { status: v.reason === "not_configured" ? 503 : 403 });
  try { await markProviderVerified("whatsapp"); } catch (e) { console.error("[whatsapp] verify mark failed:", e instanceof Error ? e.message : e); }
  return new NextResponse(v.challenge, { status: 200, headers: { "content-type": "text/plain" } });
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const sig = verifyMetaSignature(raw, req.headers.get("x-hub-signature-256"));
  if (sig === false) return NextResponse.json({ error: "bad signature" }, { status: 401 });
  let body: Record<string, unknown> = {};
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  try {
    const service = createSupabaseServiceClient();
    await service.from("whatsapp_inbound_events").insert({ payload: body, signature_verified: sig === true });
  } catch (e) { console.error("[whatsapp] store failed:", e instanceof Error ? e.message : e); }
  emitIntegrationEvent("whatsapp.inbound", { signature_verified: sig === true, entries: Array.isArray(body.entry) ? (body.entry as unknown[]).length : 0 });
  return NextResponse.json({ ok: true });
}
