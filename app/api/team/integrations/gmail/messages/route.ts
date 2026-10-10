import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listGmailMessages, getGmailMessage } from "@/lib/integrations/gmail";
import { NotConnectedError } from "@/lib/integrations/connections";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The signed-in member's own connected mailbox: list (?q=) or one message (?id=). */
export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (id) return NextResponse.json(await getGmailMessage(user.id, id));
    return NextResponse.json({ messages: await listGmailMessages(user.id, { q: req.nextUrl.searchParams.get("q") ?? undefined, max: Number(req.nextUrl.searchParams.get("max") ?? 20) }) });
  } catch (e) {
    if (e instanceof NotConnectedError) return NextResponse.json({ error: e.message }, { status: 409 });
    return NextResponse.json({ error: e instanceof Error ? e.message : "Gmail error" }, { status: 502 });
  }
}
