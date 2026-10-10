import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { connectAppleCalendar, listAppleCalendars } from "@/lib/integrations/appleCalendar";

export const runtime = "nodejs";

/** Apple ID + app-specific password → verified against iCloud CalDAV, stored encrypted. The password is never logged or echoed. */
export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { appleId?: string; appPassword?: string };
  if (!body.appleId || !body.appPassword) return NextResponse.json({ error: "Apple ID and app-specific password are required." }, { status: 400 });
  try {
    const info = await connectAppleCalendar(user.id, body.appleId.trim(), body.appPassword);
    const calendars = await listAppleCalendars(user.id).catch(() => []);
    return NextResponse.json({ ok: true, principal: info.principal, calendars: calendars.map((c) => c.name) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not connect Apple Calendar." }, { status: 400 });
  }
}

export async function GET() { return NextResponse.json({ error: "method_not_allowed" }, { status: 405 }); }
