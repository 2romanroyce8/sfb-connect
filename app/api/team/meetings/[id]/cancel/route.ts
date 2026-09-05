import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { deleteCalendarEvent } from "@/lib/crm/googleCalendar";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: meeting } = await supabase.from("crm_meetings").select("id, lead_id, rep_id, calendar_event_id").eq("id", params.id).single();
  if (!meeting) return NextResponse.json({ error: "Meeting not found or not accessible." }, { status: 404 });

  try {
    if (meeting.calendar_event_id) {
      try {
        await deleteCalendarEvent(meeting.rep_id, meeting.calendar_event_id);
      } catch {
        // Google is unreachable or already disconnected — still cancel the
        // CRM record so the rep isn't blocked, but don't claim the calendar
        // event was removed.
      }
    }
    await supabase.from("crm_meetings").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", params.id);
    await supabase.from("crm_activities").insert({ lead_id: meeting.lead_id, rep_id: user.id, activity_type: "meeting_cancelled", description: "Meeting cancelled" });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not cancel." }, { status: 400 });
  }
}
