import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/team/requireOwner";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { deleteCalendarEvent } from "@/lib/crm/googleCalendar";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cancel a demo call (owner only): removes the Google Calendar event (Google
 * emails the attendee a cancellation) and marks the row cancelled. The row is
 * kept — bookings are a record, not clutter.
 */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const gate = await requireOwner(); if ("error" in gate) return gate.error;
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const service = createSupabaseServiceClient();
  const { data: call } = await service.from("demo_calls").select("id, status, calendar_owner_id, calendar_event_id").eq("id", params.id).maybeSingle();
  if (!call) return NextResponse.json({ error: "Not found." }, { status: 404 });
  let calendar: "deleted" | "none" | `error:${string}` = "none";
  if (call.calendar_owner_id && call.calendar_event_id) {
    try { await deleteCalendarEvent(call.calendar_owner_id as string, call.calendar_event_id as string); calendar = "deleted"; }
    catch (e) { calendar = `error:${e instanceof Error ? e.message : "unknown"}`; }
  }
  await service.from("demo_calls").update({ status: "canceled" }).eq("id", call.id);
  return NextResponse.json({ ok: true, id: call.id, calendar, cancelledBy: gate.email });
}
