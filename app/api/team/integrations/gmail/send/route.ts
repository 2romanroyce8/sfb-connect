import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendGmail } from "@/lib/integrations/gmail";
import { NotConnectedError } from "@/lib/integrations/connections";
import { emitIntegrationEvent } from "@/lib/integrations/events";

export const runtime = "nodejs";

/**
 * Sends from the signed-in member's OWN connected Gmail. A human presses this;
 * the agent never calls it directly (agent drafts go through the task queue
 * and are sent here after approval).
 */
export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { to?: string; subject?: string; text?: string; html?: string; threadId?: string; inReplyTo?: string };
  if (!body.to || !body.subject || !body.text) return NextResponse.json({ error: "to, subject and text are required" }, { status: 400 });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.to)) return NextResponse.json({ error: "Invalid recipient" }, { status: 400 });
  try {
    const r = await sendGmail(user.id, { to: body.to, subject: body.subject.slice(0, 300), text: body.text.slice(0, 20000), html: body.html?.slice(0, 60000), threadId: body.threadId, inReplyTo: body.inReplyTo });
    emitIntegrationEvent("gmail.sent", { message_id: r.id, thread_id: r.threadId, to: body.to, subject: body.subject, sent_by: user.id });
    return NextResponse.json(r);
  } catch (e) {
    if (e instanceof NotConnectedError) return NextResponse.json({ error: e.message }, { status: 409 });
    return NextResponse.json({ error: e instanceof Error ? e.message : "Gmail send failed" }, { status: 502 });
  }
}
