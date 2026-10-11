import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { recordOpen } from "@/lib/outbound/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

/** 1×1 open pixel. Best-effort; never errors to the mail client. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id.replace(/\.gif$/i, "");
  if (/^[0-9a-f-]{36}$/i.test(id)) { try { await recordOpen(createSupabaseServiceClient(), id); } catch { /* ignore */ } }
  return new NextResponse(GIF, { status: 200, headers: { "content-type": "image/gif", "cache-control": "no-store, max-age=0" } });
}
