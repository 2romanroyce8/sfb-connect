import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { createCalendarEvent, GoogleNotConnectedError, GoogleAuthExpiredError } from "@/lib/crm/googleCalendar";
import { formatInTimeZone } from "@/lib/crm/timezone";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: lead } = await supabase.from("crm_leads").select("id, business_name, phone").eq("id", params.id).single();
  if (!lead) return NextResponse.json({ error: "Lead not found or not accessible." }, { status: 404 });

  const { data: profile } = await supabase.from("users").select("full_name, email").eq("id", user.id).single();
  const repName = profile?.full_name || profile?.email || "your SFB Connect rep";

  const body = await req.json();
  const { contactName, contactEmail, contactPhone, startISO, endISO, timeZone, repNotes, callId } = body;
  if (!startISO || !endISO || !timeZone) return NextResponse.json({ error: "Missing meeting time." }, { status: 400 });

  const description = [
    `Business:\n${lead.business_name || "Unknown"}`,
    `\nContact:\n${contactName || "—"}`,
    `\nPhone:\n${contactPhone || lead.phone || "—"}`,
    `\nEmail:\n${contactEmail || "—"}`,
    `\nLead:\nhttps://sfbconnect.com/team/leads/${lead.id}`,
    repNotes ? `\nRep notes:\n${repNotes}` : "",
  ].join("\n");

  const service = createSupabaseServiceClient();

  try {
    const event = await createCalendarEvent(user.id, {
      summary: `SFB Connect — ${lead.business_name || "New Lead"}`,
      description,
      startISO,
      endISO,
      timeZone,
    });

    const { data: meeting, error } = await service
      .from("crm_meetings")
      .insert({
        lead_id: lead.id,
        rep_id: user.id,
        call_id: callId || null,
        scheduled_at: startISO,
        ends_at: endISO,
        timezone: timeZone,
        duration_minutes: Math.round((new Date(endISO).getTime() - new Date(startISO).getTime()) / 60000),
        contact_name: contactName || null,
        contact_email: contactEmail || null,
        contact_phone: contactPhone || lead.phone || null,
        calendar_event_id: event.eventId,
        google_calendar_id: "primary",
        google_meet_url: event.meetUrl,
        rep_notes: repNotes || null,
        status: "booked",
      })
      .select("*")
      .single();

    if (error || !meeting) throw new Error(error?.message || "Meeting created in Google Calendar but could not be saved to the CRM — check Meetings and add it manually if it's missing.");

    await service.from("crm_leads").update({ pipeline_stage: "meeting_booked", updated_at: new Date().toISOString() }).eq("id", lead.id);
    await service.from("crm_pipeline_history").insert({ lead_id: lead.id, to_stage: "meeting_booked", changed_by: user.id });
    await service.from("crm_activities").insert({
      lead_id: lead.id,
      rep_id: user.id,
      activity_type: "meeting_booked",
      description: `Meeting booked for ${formatInTimeZone(startISO, timeZone, { month: "short", day: "numeric" })} at ${formatInTimeZone(startISO, timeZone, { hour: "numeric", minute: "2-digit" })}`,
    });

    if (callId) {
      const { data: call } = await service.from("crm_calls").select("started_at").eq("id", callId).single();
      if (call) {
        const durationSeconds = Math.max(0, Math.round((Date.now() - new Date(call.started_at).getTime()) / 1000));
        await service.from("crm_calls").update({ ended_at: new Date().toISOString(), duration_seconds: durationSeconds, outcome: "booked_meeting" }).eq("id", callId);
      }
    }

    const dateLabel = formatInTimeZone(startISO, timeZone, { weekday: "long", month: "long", day: "numeric" });
    const timeLabel = formatInTimeZone(startISO, timeZone, { hour: "numeric", minute: "2-digit" });
    const tzLabel = formatInTimeZone(startISO, timeZone, { timeZoneName: "short" }).split(" ").pop();
    const confirmationMessage = `Hey ${contactName ? contactName.split(" ")[0] : "there"}, this is ${repName} with SFB Connect. You're confirmed for ${dateLabel} at ${timeLabel} ${tzLabel}.${
      event.meetUrl ? `\n\nGoogle Meet:\n${event.meetUrl}` : ""
    }\n\nLooking forward to speaking with you.`;

    return NextResponse.json({ meeting, meetUrl: event.meetUrl, htmlLink: event.htmlLink, confirmationMessage });
  } catch (err) {
    if (err instanceof GoogleNotConnectedError) return NextResponse.json({ error: "google_not_connected", message: err.message }, { status: 409 });
    if (err instanceof GoogleAuthExpiredError) return NextResponse.json({ error: "google_auth_expired", message: err.message }, { status: 409 });
    // Google booking failed — do not record a meeting or move the pipeline.
    // The rep can retry once the underlying issue (network, permissions) is
    // resolved, and nothing here has silently claimed success.
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not book the meeting." }, { status: 400 });
  }
}
