import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function toIcsDate(iso: string) {
  return new Date(iso).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function buildIcs(params: { uid: string; title: string; description: string; startAt: string; endAt: string; location?: string; url?: string }) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SFB Connect//Sales OS//EN",
    "BEGIN:VEVENT",
    `UID:${params.uid}@sfbconnect.com`,
    `DTSTAMP:${toIcsDate(new Date().toISOString())}`,
    `DTSTART:${toIcsDate(params.startAt)}`,
    `DTEND:${toIcsDate(params.endAt)}`,
    `SUMMARY:${params.title.replace(/\n/g, " ")}`,
    `DESCRIPTION:${(params.description || "").replace(/\n/g, "\\n")}`,
    params.location ? `LOCATION:${params.location}` : "",
    params.url ? `URL:${params.url}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return lines.join("\r\n");
}

// Real .ics generation from real stored event data -- no fake availability,
// no placeholder times. Works for both personal/work events and CRM
// meetings, since both are legitimately shareable via calendar file.
export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const type = req.nextUrl.searchParams.get("type");
  const id = req.nextUrl.searchParams.get("id");
  if (!id || !type) return NextResponse.json({ error: "Missing type or id." }, { status: 400 });

  let ics: string;
  if (type === "meeting") {
    const { data: m } = await supabase.from("crm_meetings").select("id, scheduled_at, ends_at, contact_name, google_meet_url, lead_id").eq("id", id).single();
    if (!m) return NextResponse.json({ error: "Meeting not found or not accessible." }, { status: 404 });
    const { data: lead } = await supabase.from("crm_leads").select("business_name").eq("id", m.lead_id).single();
    ics = buildIcs({
      uid: m.id,
      title: `SFB Connect — ${lead?.business_name || "Meeting"}`,
      description: m.contact_name ? `With ${m.contact_name}` : "",
      startAt: m.scheduled_at,
      endAt: m.ends_at || m.scheduled_at,
      url: m.google_meet_url || undefined,
    });
  } else {
    const { data: e } = await supabase.from("crm_calendar_events").select("id, title, description, start_at, end_at, location, external_meeting_url").eq("id", id).single();
    if (!e) return NextResponse.json({ error: "Event not found or not accessible." }, { status: 404 });
    ics = buildIcs({ uid: e.id, title: e.title, description: e.description || "", startAt: e.start_at, endAt: e.end_at, location: e.location || undefined, url: e.external_meeting_url || undefined });
  }

  return new NextResponse(ics, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="event.ics"` } });
}
