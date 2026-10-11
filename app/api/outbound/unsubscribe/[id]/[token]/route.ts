import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { unsubscribe } from "@/lib/outbound/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const page = (title: string, body: string) => new NextResponse(`<!doctype html><html><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>${title}</title></head><body style="margin:0;background:#000;color:#f5f5f7;font-family:Inter,Helvetica,Arial,sans-serif"><div style="max-width:520px;margin:0 auto;padding:64px 24px"><h1 style="font-size:22px;letter-spacing:-.02em">${title}</h1><p style="font-size:15px;line-height:1.6;color:#c9c9ce">${body}</p></div></body></html>`, { headers: { "content-type": "text/html; charset=utf-8" } });

/** One-click unsubscribe. The token is derived per message, so a link can't be forged for another address. */
export async function GET(_req: NextRequest, { params }: { params: { id: string; token: string } }) {
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) return page("Link not recognised", "This unsubscribe link isn't valid.");
  const ok = await unsubscribe(createSupabaseServiceClient(), params.id, params.token);
  return ok ? page("You're unsubscribed.", "You won't hear from this sender again. Nothing else to do.") : page("Link not recognised", "This unsubscribe link isn't valid or has already been used.");
}
