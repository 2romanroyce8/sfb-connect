import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getBusyBlocks, GoogleNotConnectedError, GoogleAuthExpiredError } from "@/lib/crm/googleCalendar";
import { zonedTimeToUtcISO } from "@/lib/crm/timezone";

const BUSINESS_START = "09:00";
const BUSINESS_END = "17:30";
const DAYS_AHEAD = 7;
const MAX_SLOTS = 8;
const MAX_PER_DAY_IN_LIST = 3;

function localDateStr(d: Date, timeZone: string): string {
  // en-CA formats as YYYY-MM-DD, which is exactly what zonedTimeToUtcISO wants.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return new Date(aStart) < new Date(bEnd) && new Date(bStart) < new Date(aEnd);
}

// Real availability only. If Google isn't connected, this returns
// googleConnected:false and the client is responsible for making that
// honest in the UI rather than showing invented "available" slots.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: lead } = await supabase.from("crm_leads").select("id").eq("id", params.id).single();
  if (!lead) return NextResponse.json({ error: "Lead not found or not accessible." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const durationMinutes: number = body.durationMinutes || 30;
  const timeZone: string = body.timeZone;
  const onlyDate: string | undefined = body.date; // "YYYY-MM-DD" -- when set, return slots for just that one day
  if (!timeZone) return NextResponse.json({ error: "Timezone is required." }, { status: 400 });

  try {
    const now = new Date();
    const daysToScan = onlyDate ? [onlyDate] : Array.from({ length: DAYS_AHEAD }, (_, i) => localDateStr(new Date(now.getTime() + i * 86400000), timeZone));

    const windowStart = now.toISOString();
    const lastDay = daysToScan[daysToScan.length - 1];
    const windowEnd = zonedTimeToUtcISO(lastDay, BUSINESS_END, timeZone);
    const busy = await getBusyBlocks(user.id, windowStart, windowEnd);

    const dayEntries: { dateStr: string; slots: { startISO: string; endISO: string }[] }[] = [];
    for (const dateStr of daysToScan) {
      const dayStartISO = zonedTimeToUtcISO(dateStr, BUSINESS_START, timeZone);
      const dayEndISO = zonedTimeToUtcISO(dateStr, BUSINESS_END, timeZone);
      const dayEndDate = new Date(dayEndISO);
      let cursor = new Date(Math.max(new Date(dayStartISO).getTime(), now.getTime() + 30 * 60000));
      const free: { startISO: string; endISO: string }[] = [];
      while (cursor < dayEndDate) {
        const slotEnd = new Date(cursor.getTime() + durationMinutes * 60000);
        if (slotEnd <= dayEndDate && !busy.some((b) => overlaps(cursor.toISOString(), slotEnd.toISOString(), b.start, b.end))) {
          free.push({ startISO: cursor.toISOString(), endISO: slotEnd.toISOString() });
        }
        cursor = new Date(cursor.getTime() + 30 * 60000);
      }
      if (free.length > 0) dayEntries.push({ dateStr, slots: free });
    }

    if (onlyDate) {
      // Single-day request (from the expanded custom calendar) -- return
      // every real free slot that day, not capped to 3, so the time-chip
      // grid has real choices.
      const slots = (dayEntries[0]?.slots || []).map((s) => ({
        startISO: s.startISO,
        endISO: s.endISO,
        timeLabel: new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(new Date(s.startISO)),
      }));
      return NextResponse.json({ googleConnected: true, timeZone, slots });
    }

    // Flat "next available" list across the upcoming days -- each row is
    // one bookable slot, day-status (AVAILABLE/LIMITED) reflects how many
    // openings that whole day actually has.
    const flatSlots: { startISO: string; endISO: string; dayNumber: string; monthAbbr: string; weekday: string; timeLabel: string; status: "AVAILABLE" | "LIMITED" }[] = [];
    outer: for (const { dateStr, slots } of dayEntries) {
      const status: "AVAILABLE" | "LIMITED" = slots.length >= 3 ? "AVAILABLE" : "LIMITED";
      for (const s of slots.slice(0, MAX_PER_DAY_IN_LIST)) {
        const d = new Date(s.startISO);
        flatSlots.push({
          startISO: s.startISO,
          endISO: s.endISO,
          dayNumber: new Intl.DateTimeFormat("en-US", { timeZone, day: "2-digit" }).format(d),
          monthAbbr: new Intl.DateTimeFormat("en-US", { timeZone, month: "short" }).format(d).toUpperCase(),
          weekday: new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(d),
          timeLabel: new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(d),
          status,
        });
        if (flatSlots.length >= MAX_SLOTS) break outer;
      }
    }

    return NextResponse.json({ googleConnected: true, timeZone, slots: flatSlots });
  } catch (err) {
    if (err instanceof GoogleNotConnectedError) return NextResponse.json({ googleConnected: false, reason: "not_connected" });
    if (err instanceof GoogleAuthExpiredError) return NextResponse.json({ googleConnected: false, reason: "auth_expired" });
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not load availability." }, { status: 400 });
  }
}
