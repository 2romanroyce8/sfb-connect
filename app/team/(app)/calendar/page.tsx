import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listUpcomingEvents } from "@/lib/crm/googleCalendar";

const RANGE_DAYS: Record<string, number> = { day: 1, week: 7, month: 30 };

export default async function CalendarPage({ searchParams }: { searchParams: { view?: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: caller } = await supabase.from("users").select("team_role").eq("id", user!.id).single();
  const isOwner = caller?.team_role === "owner";

  const view = searchParams.view && RANGE_DAYS[searchParams.view] ? searchParams.view : "week";
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + RANGE_DAYS[view]);

  const [{ data: meetings }, { data: followups }] = await Promise.all([
    supabase
      .from("crm_meetings")
      .select("id, lead_id, scheduled_at, contact_name, status, google_meet_url, calendar_event_id")
      .gte("scheduled_at", start.toISOString())
      .lt("scheduled_at", end.toISOString())
      .order("scheduled_at", { ascending: true }),
    supabase
      .from("crm_followups")
      .select("id, lead_id, due_at, reason, status")
      .eq("status", "open")
      .gte("due_at", start.toISOString())
      .lt("due_at", end.toISOString())
      .order("due_at", { ascending: true }),
  ]);

  const leadIds = Array.from(new Set([...(meetings ?? []).map((m) => m.lead_id), ...(followups ?? []).map((f) => f.lead_id)]));
  const { data: leads } = leadIds.length ? await supabase.from("crm_leads").select("id, business_name").in("id", leadIds) : { data: [] as any[] };
  const leadMap = Object.fromEntries((leads ?? []).map((l) => [l.id, l.business_name]));

  type Event = { id: string; at: string; type: "meeting" | "follow_up" | "google"; title: string; leadId?: string; extra?: string };
  const syncedEventIds = new Set((meetings ?? []).map((m) => m.calendar_event_id).filter(Boolean));

  // Only ever the CURRENT user's own connected calendar — per the security
  // rule, nobody (including the owner) reads another rep's Google events.
  let googleEvents: Event[] = [];
  try {
    const raw = await listUpcomingEvents(user!.id, start.toISOString(), end.toISOString());
    googleEvents = raw
      .filter((e) => !syncedEventIds.has(e.id) && e.status !== "cancelled")
      .map((e) => ({
        id: `google-${e.id}`,
        at: e.start?.dateTime || e.start?.date,
        type: "google" as const,
        title: e.summary || "Google Calendar event",
        extra: "From your Google Calendar",
      }));
  } catch {
    // Not connected, or token expired — the CRM events below still render;
    // this section just contributes nothing rather than erroring the page.
  }

  const events: Event[] = [
    ...(meetings ?? []).map((m) => ({
      id: m.id,
      at: m.scheduled_at,
      type: "meeting" as const,
      title: `Meeting — ${leadMap[m.lead_id] || "Unknown lead"}`,
      leadId: m.lead_id,
      extra: m.google_meet_url ? "Video link ready" : "No video link yet",
    })),
    ...(followups ?? []).map((f) => ({
      id: f.id,
      at: f.due_at,
      type: "follow_up" as const,
      title: `Follow-up — ${leadMap[f.lead_id] || "Unknown lead"}`,
      leadId: f.lead_id,
      extra: f.reason || undefined,
    })),
    ...googleEvents,
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  const byDay = new Map<string, Event[]>();
  for (const e of events) {
    const key = new Date(e.at).toDateString();
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(e);
  }

  return (
    <div className="px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[20px] font-semibold text-[#F5F5F7]">Calendar</div>
          <div className="text-[13px] text-[#6E6E73] mt-1">{isOwner ? "Team schedule" : "Your schedule"} — meetings and follow-ups</div>
        </div>
        <div className="flex items-center gap-1">
          {[
            ["day", "Day"],
            ["week", "Week"],
            ["month", "Month"],
          ].map(([value, label]) => (
            <Link
              key={value}
              href={`/team/calendar?view=${value}`}
              className="h-[32px] px-3 inline-flex items-center rounded-[7px] text-[12.5px]"
              style={{
                background: view === value ? "#151515" : "transparent",
                color: view === value ? "#F5F5F7" : "#6E6E73",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      {events.length === 0 ? (
        <div className="rounded-[14px] p-10 text-center max-w-[480px]" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="text-[15px] font-medium text-[#F5F5F7] mb-1.5">Nothing scheduled</div>
          <p className="text-[13px] text-[#A1A1A6]">Meetings and follow-ups you create will appear here.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6 max-w-[640px]">
          {Array.from(byDay.entries()).map(([day, dayEvents]) => (
            <div key={day}>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[#6E6E73] mb-2">
                {new Date(day).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
              </div>
              <div className="flex flex-col gap-2">
                {dayEvents.map((e) => {
                  const content = (
                    <>
                      <div>
                        <div className="text-[13px] text-[#F5F5F7]">{e.title}</div>
                        {e.extra && <div className="text-[11.5px] text-[#6E6E73] mt-0.5">{e.extra}</div>}
                      </div>
                      <div className="text-[12px] text-[#A1A1A6]">
                        {new Date(e.at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                      </div>
                    </>
                  );
                  const className = "flex items-center justify-between p-3.5 rounded-[10px]";
                  const style = { background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" };
                  return e.leadId ? (
                    <Link key={e.id} href={`/team/leads/${e.leadId}`} className={className} style={style}>
                      {content}
                    </Link>
                  ) : (
                    <div key={e.id} className={className} style={style}>
                      {content}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
