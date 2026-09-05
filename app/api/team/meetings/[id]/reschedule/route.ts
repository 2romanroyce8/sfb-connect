import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateCalendarEvent, GoogleNotConnectedError, GoogleAuthExpiredError } from "@/lib/crm/googleCalendar";

// RLS on crm_meetings (rep_id = auth.uid() or owner) governs the select and
// update directly on the session client.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { startISO, endISO, timeZone } = await req.json();
  if (!startISO || !endISO) return NextResponse.json({ error: "Missing new time." }, { status: 400 });

  const { data: meeting } = await supabase.from("crm_meetings").select("id, lead_id, rep_id, calendar_event_id").eq("id", params.id).single();
  if (!meeting) return NextResponse.json({ error: "Meeting not found or not accessible." }, { status: 404 });

  try {
    if (meeting.calendar_event_id) {
      await updateCalendarEvent(meeting.rep_id, meeting.calendar_event_id, { startISO, endISO, timeZone });
    }
    await supabase
      .from("crm_meetings")
      .update({ scheduled_at: startISO, ends_at: endISO, timezone: timeZone || undefined, status: "booked", updated_at: new Date().toISOString() })
      .eq("id", params.id);

    await supabase.from("crm_activities").insert({ lead_id: meeting.lead_id, rep_id: user.id, activity_type: "meeting_rescheduled", description: "Meeting rescheduled" });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof GoogleNotConnectedError || err instanceof GoogleAuthExpiredError) {
      return NextResponse.json({ error: "google_auth_issue", message: err.message }, { status: 409 });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not reschedule." }, { status: 400 });
  }
}
