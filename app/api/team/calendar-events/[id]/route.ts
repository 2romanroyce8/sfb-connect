import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const EDITABLE = ["title", "description", "startAt", "endAt", "allDay", "timezone", "eventType", "location", "externalMeetingUrl", "relatedLeadId", "visibility", "visibleTo", "reminderMinutes", "status"];
const FIELD_MAP: Record<string, string> = {
  startAt: "start_at",
  endAt: "end_at",
  allDay: "all_day",
  eventType: "event_type",
  externalMeetingUrl: "external_meeting_url",
  relatedLeadId: "related_lead_id",
  visibleTo: "visible_to",
  reminderMinutes: "reminder_minutes",
};

// RLS (owner_id = auth.uid() OR is_team_owner()) governs writes directly --
// a rep can only edit/delete their own events even if they somehow guess
// another event's id.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json();
  const update: Record<string, unknown> = { updated_by: user.id, updated_at: new Date().toISOString() };
  for (const key of EDITABLE) {
    if (key in body) update[FIELD_MAP[key] || key] = body[key];
  }

  const { error } = await supabase.from("crm_calendar_events").update(update).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { error } = await supabase.from("crm_calendar_events").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
