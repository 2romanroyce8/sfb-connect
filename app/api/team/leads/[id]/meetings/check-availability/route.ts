import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getBusyBlocks, GoogleNotConnectedError, GoogleAuthExpiredError } from "@/lib/crm/googleCalendar";
import { zonedTimeToUtcISO } from "@/lib/crm/timezone";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: lead } = await supabase.from("crm_leads").select("id").eq("id", params.id).single();
  if (!lead) return NextResponse.json({ error: "Lead not found or not accessible." }, { status: 404 });

  const { date, time, durationMinutes, timeZone } = await req.json();
  if (!date || !time || !timeZone) return NextResponse.json({ error: "Date, time, and timezone are required." }, { status: 400 });
  const duration = durationMinutes || 30;

  const startISO = zonedTimeToUtcISO(date, time, timeZone);
  const endISO = new Date(new Date(startISO).getTime() + duration * 60000).toISOString();

  try {
    // Check a window around the requested time so we can suggest real
    // nearby openings if there's a conflict, not just say "no".
    const windowStart = zonedTimeToUtcISO(date, "07:00", timeZone);
    const windowEnd = zonedTimeToUtcISO(date, "20:00", timeZone);
    const busy = await getBusyBlocks(user.id, windowStart, windowEnd);

    const overlaps = (aStart: string, aEnd: string, bStart: string, bEnd: string) =>
      new Date(aStart) < new Date(bEnd) && new Date(bStart) < new Date(aEnd);

    const conflict = busy.some((b) => overlaps(startISO, endISO, b.start, b.end));

    if (!conflict) {
      return NextResponse.json({ available: true, startISO, endISO });
    }

    // Suggest up to 3 open slots in 30-minute increments across the window.
    const suggestions: { startISO: string; endISO: string; label: string }[] = [];
    let cursor = new Date(windowStart);
    const windowEndDate = new Date(windowEnd);
    while (cursor < windowEndDate && suggestions.length < 3) {
      const slotEnd = new Date(cursor.getTime() + duration * 60000);
      if (slotEnd <= windowEndDate && !busy.some((b) => overlaps(cursor.toISOString(), slotEnd.toISOString(), b.start, b.end))) {
        suggestions.push({
          startISO: cursor.toISOString(),
          endISO: slotEnd.toISOString(),
          label: new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(cursor),
        });
      }
      cursor = new Date(cursor.getTime() + 30 * 60000);
    }

    return NextResponse.json({ available: false, message: "You're busy at this time.", suggestions });
  } catch (err) {
    if (err instanceof GoogleNotConnectedError) return NextResponse.json({ error: "google_not_connected", message: err.message }, { status: 409 });
    if (err instanceof GoogleAuthExpiredError) return NextResponse.json({ error: "google_auth_expired", message: err.message }, { status: 409 });
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not check availability." }, { status: 400 });
  }
}
