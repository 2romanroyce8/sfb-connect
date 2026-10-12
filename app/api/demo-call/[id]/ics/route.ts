import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { icsFor } from "@/lib/demoCall/booking";
import { appOrigin } from "@/lib/agent/auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The .ics for one booking (Apple Calendar / Outlook desktop). The id is an unguessable uuid; the file holds only the slot and Meet link. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) return new NextResponse("Not found", { status: 404 });
  const { data } = await createSupabaseServiceClient().from("demo_calls").select("id, name, start_at, end_at, meet_url").eq("id", params.id).maybeSingle();
  if (!data) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(icsFor(data, appOrigin(req)), { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'attachment; filename="sfb-connect-demo.ics"', "Cache-Control": "no-store" } });
}
