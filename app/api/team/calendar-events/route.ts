import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json();
  const { title, description, startAt, endAt, allDay, timezone, calendarType, eventType, location, externalMeetingUrl, relatedLeadId, visibility, visibleTo, reminderMinutes } = body;

  if (!title || !startAt || !endAt) return NextResponse.json({ error: "Title, start, and end are required." }, { status: 400 });
  if (!["personal", "work"].includes(calendarType)) return NextResponse.json({ error: "Invalid calendar type." }, { status: 400 });

  const { data: event, error } = await supabase
    .from("crm_calendar_events")
    .insert({
      owner_id: user.id,
      title,
      description: description || null,
      start_at: startAt,
      end_at: endAt,
      all_day: !!allDay,
      timezone: timezone || "America/New_York",
      calendar_type: calendarType,
      event_type: eventType || "task",
      location: location || null,
      external_meeting_url: externalMeetingUrl || null,
      related_lead_id: relatedLeadId || null,
      visibility: visibility || "private",
      visible_to: visibleTo || [],
      reminder_minutes: reminderMinutes || null,
      created_by: user.id,
      updated_by: user.id,
    })
    .select("*")
    .single();

  if (error || !event) return NextResponse.json({ error: error?.message || "Could not create event." }, { status: 400 });

  await supabase.from("crm_activities").insert({
    lead_id: relatedLeadId || null,
    rep_id: user.id,
    activity_type: "calendar_event_created",
    description: `Calendar event created: ${title}`,
  });

  return NextResponse.json(event);
}
