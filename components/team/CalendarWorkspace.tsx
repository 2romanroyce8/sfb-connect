"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  Video,
  BriefcaseBusiness,
  Globe2,
  UserRound,
  Eye,
  Plus,
  X,
  Loader2,
  Download,
  Copy,
  Trash2,
  ExternalLink,
} from "lucide-react";

type Meeting = { id: string; lead_id: string; rep_id: string; scheduled_at: string; ends_at: string | null; contact_name: string | null; contact_email: string | null; google_meet_url: string | null; status: string; timezone: string };
type Followup = { id: string; lead_id: string; rep_id: string; due_at: string; reason: string | null; status: string };
type PersonalWork = {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  timezone: string;
  calendar_type: "personal" | "work";
  event_type: string;
  location: string | null;
  external_meeting_url: string | null;
  related_lead_id: string | null;
  visibility: string;
  created_by: string;
  status: string;
};
type GoogleEvent = { id: string; summary?: string; start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string }; htmlLink?: string };
type Lead = { id: string; business_name: string | null; phone: string | null; email: string | null; pipeline_stage: string };

type UnifiedEvent = {
  id: string;
  source: "meeting" | "followup" | "personal_work" | "google";
  title: string;
  startAt: string;
  endAt: string;
  calendarType: "work" | "personal";
  eventType: string;
  description: string;
  location: string;
  meetUrl: string | null;
  leadId: string | null;
  timezone: string;
  createdByLabel: string;
  visibility: string;
  status: string;
  raw: any;
};

const MODE_TABS = ["PERSONAL", "WORK", "PERSONAL + WORK", "TEAM"] as const;
type Mode = (typeof MODE_TABS)[number];

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

export default function CalendarWorkspace({
  currentUser,
  isOwner,
  year,
  monthIndex,
  meetings,
  followups,
  personalWork,
  googleEvents,
  leadMap,
}: {
  currentUser: { id: string; name: string };
  isOwner: boolean;
  year: number;
  monthIndex: number;
  meetings: Meeting[];
  followups: Followup[];
  personalWork: PersonalWork[];
  googleEvents: GoogleEvent[];
  leadMap: Record<string, Lead>;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("WORK");
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState(() => today.toISOString().slice(0, 10));
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);

  const events: UnifiedEvent[] = useMemo(() => {
    const list: UnifiedEvent[] = [];
    for (const m of meetings) {
      list.push({
        id: `meeting-${m.id}`,
        source: "meeting",
        title: `Meeting — ${leadMap[m.lead_id]?.business_name || "Unknown lead"}`,
        startAt: m.scheduled_at,
        endAt: m.ends_at || m.scheduled_at,
        calendarType: "work",
        eventType: "meeting",
        description: m.contact_name ? `With ${m.contact_name}` : "",
        location: "",
        meetUrl: m.google_meet_url,
        leadId: m.lead_id,
        timezone: m.timezone,
        createdByLabel: "SFB Sales OS",
        visibility: "company",
        status: m.status,
        raw: m,
      });
    }
    for (const f of followups) {
      list.push({
        id: `followup-${f.id}`,
        source: "followup",
        title: `Follow-up — ${leadMap[f.lead_id]?.business_name || "Unknown lead"}`,
        startAt: f.due_at,
        endAt: f.due_at,
        calendarType: "work",
        eventType: "follow_up",
        description: f.reason || "",
        location: "",
        meetUrl: null,
        leadId: f.lead_id,
        timezone: "America/New_York",
        createdByLabel: "SFB Sales OS",
        visibility: "private",
        status: f.status,
        raw: f,
      });
    }
    for (const e of personalWork) {
      list.push({
        id: `event-${e.id}`,
        source: "personal_work",
        title: e.title,
        startAt: e.start_at,
        endAt: e.end_at,
        calendarType: e.calendar_type,
        eventType: e.event_type,
        description: e.description || "",
        location: e.location || "",
        meetUrl: e.external_meeting_url,
        leadId: e.related_lead_id,
        timezone: e.timezone,
        createdByLabel: e.created_by === currentUser.id ? currentUser.name : "Teammate",
        visibility: e.visibility,
        status: e.status,
        raw: e,
      });
    }
    for (const g of googleEvents) {
      const start = g.start?.dateTime || g.start?.date;
      const end = g.end?.dateTime || g.end?.date;
      if (!start || !end) continue;
      list.push({
        id: `google-${g.id}`,
        source: "google",
        title: g.summary || "Google Calendar event",
        startAt: start,
        endAt: end,
        calendarType: "personal",
        eventType: "personal",
        description: "From your connected Google Calendar",
        location: "",
        meetUrl: g.htmlLink || null,
        leadId: null,
        timezone: currentUser.name ? Intl.DateTimeFormat().resolvedOptions().timeZone : "America/New_York",
        createdByLabel: "Google Calendar",
        visibility: "private",
        status: "confirmed",
        raw: g,
      });
    }
    return list.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  }, [meetings, followups, personalWork, googleEvents, leadMap, currentUser]);

  const filteredEvents = useMemo(() => {
    if (mode === "TEAM") return events; // owner-only tab; RLS already scoped the fetch
    if (mode === "PERSONAL + WORK") return events;
    if (mode === "PERSONAL") return events.filter((e) => e.calendarType === "personal");
    return events.filter((e) => e.calendarType === "work"); // WORK
  }, [events, mode]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, UnifiedEvent[]>();
    for (const e of filteredEvents) {
      const key = dayKey(e.startAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return map;
  }, [filteredEvents]);

  const gridStart = useMemo(() => {
    const d = new Date(year, monthIndex, 1);
    d.setDate(d.getDate() - d.getDay());
    return d;
  }, [year, monthIndex]);

  const cells = useMemo(() => {
    const list: { date: Date; key: string; inMonth: boolean }[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(d.getDate() + i);
      list.push({ date: d, key: d.toISOString().slice(0, 10), inMonth: d.getMonth() === monthIndex });
    }
    return list;
  }, [gridStart, monthIndex]);

  const selectedDayEvents = eventsByDay.get(selectedDate) || [];
  const selectedEvent = filteredEvents.find((e) => e.id === selectedEventId) || selectedDayEvents[0] || null;

  function prevMonth() {
    const d = new Date(year, monthIndex - 1, 1);
    router.push(`/team/calendar?month=${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  function nextMonth() {
    const d = new Date(year, monthIndex + 1, 1);
    router.push(`/team/calendar?month=${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  async function shareEvent(e: UnifiedEvent) {
    const type = e.source === "meeting" ? "meeting" : "event";
    const rawId = e.raw.id;
    window.open(`/api/team/calendar/ics?type=${type}&id=${rawId}`, "_blank");
  }

  function copyLink(e: UnifiedEvent) {
    navigator.clipboard.writeText(`${window.location.origin}/team/leads/${e.leadId || ""}`);
  }

  async function cancelMeeting(e: UnifiedEvent) {
    setBusy(true);
    try {
      await fetch(`/api/team/meetings/${e.raw.id}/cancel`, { method: "POST" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function deletePersonalEvent(e: UnifiedEvent) {
    if (!confirm("Delete this event?")) return;
    setBusy(true);
    try {
      await fetch(`/api/team/calendar-events/${e.raw.id}`, { method: "DELETE" });
      setSelectedEventId(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const monthLabel = new Date(year, monthIndex, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const selectedDayLabel = new Date(selectedDate + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric" });

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#0B0B0B", padding: "84px 34px" }}>
      <div
        className="grid overflow-hidden"
        style={{
          width: "min(1180px, calc(100vw - 68px))",
          minHeight: 690,
          gridTemplateColumns: "370px minmax(560px, 1fr) 320px",
          background: "#121212",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 10,
          boxShadow: "0 24px 70px rgba(0,0,0,0.25)",
        }}
      >
        {/* LEFT: selected event details */}
        <div className="flex flex-col" style={{ background: "#141414", borderRight: "1px solid rgba(255,255,255,0.07)", padding: 32 }}>
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center text-[12px] font-bold">
              {currentUser.name.slice(0, 1).toUpperCase()}
            </div>
            <span className="text-[16px] font-medium text-[#B8B8B8]">{currentUser.name}</span>
          </div>

          {selectedEvent ? (
            <>
              <div className="text-[29px] font-semibold text-[#F3F3F3] mb-1.5" style={{ lineHeight: 1.1, letterSpacing: "-0.02em" }}>
                {selectedEvent.title}
              </div>
              <div className="text-[13px] text-[#A7A7A7] mb-4 capitalize">{selectedEvent.eventType.replace(/_/g, " ")} · SFB Connect</div>
              {selectedEvent.description && <p className="text-[14px] text-[#C8C8C8] leading-[1.55] max-h-[190px] overflow-y-auto pr-2">{selectedEvent.description}</p>}

              <div className="flex flex-col gap-[18px]" style={{ marginTop: 26 }}>
                <MetaRow icon={Clock3} label="Duration" value={`${new Date(selectedEvent.startAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}${selectedEvent.endAt !== selectedEvent.startAt ? ` – ${new Date(selectedEvent.endAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}` : ""}`} />
                {selectedEvent.meetUrl && <MetaRow icon={Video} label="Meeting" value={selectedEvent.source === "meeting" ? "Google Meet" : "Link"} />}
                {selectedEvent.leadId && <MetaRow icon={BriefcaseBusiness} label="Lead" value={leadMap[selectedEvent.leadId]?.business_name || "Attached Lead"} />}
                <MetaRow icon={Globe2} label="Timezone" value={selectedEvent.timezone} />
                <MetaRow icon={UserRound} label="Created by" value={selectedEvent.createdByLabel} />
                <MetaRow icon={Eye} label="Visibility" value={selectedEvent.visibility === "company" ? "Company" : selectedEvent.visibility === "specific" ? "Specific People" : "Private"} />
              </div>
            </>
          ) : (
            <div className="text-[14px] text-[#7C7C7C] mt-8">Select a day or event to see details here.</div>
          )}
        </div>

        {/* CENTER: month grid */}
        <div className="relative" style={{ background: "#151515", padding: 28 }}>
          <div className="flex items-center gap-1.5 mb-4">
            {MODE_TABS.filter((m) => m !== "TEAM" || isOwner).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className="h-[28px] px-2.5 rounded-[6px] text-[11px]"
                style={{ background: mode === m ? "#F2F2F2" : "#101010", color: mode === m ? "#111111" : "#8B8B8B", border: "1px solid rgba(255,255,255,0.05)" }}
              >
                {m}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between" style={{ marginBottom: 28 }}>
            <div className="text-[25px] font-semibold text-[#F5F5F7]" style={{ letterSpacing: "-0.02em" }}>
              {monthLabel}
            </div>
            <div className="flex items-center gap-[18px]">
              <button onClick={prevMonth} className="text-[#7B7B7B] hover:text-white">
                <ChevronLeft size={20} />
              </button>
              <button onClick={nextMonth} className="text-[#7B7B7B] hover:text-white">
                <ChevronRight size={20} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1" style={{ marginBottom: 22 }}>
            {WEEKDAYS.map((w) => (
              <div key={w} className="text-center text-[13px] font-semibold text-[#F0F0F0]" style={{ letterSpacing: "0.12em" }}>
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-[5px]">
            {cells.map(({ date, key, inMonth }) => {
              const dayEvents = eventsByDay.get(key) || [];
              const isSelected = key === selectedDate;
              const isToday = key === today.toISOString().slice(0, 10);
              return (
                <button
                  key={key}
                  onClick={() => {
                    setSelectedDate(key);
                    setSelectedEventId(null);
                  }}
                  className="relative flex items-center justify-center"
                  style={{
                    aspectRatio: "1.08 / 1",
                    minHeight: 78,
                    background: isSelected ? "#F1F1F1" : inMonth ? "#3D3D3D" : "#333333",
                    border: isSelected ? "1px solid rgba(255,255,255,0.6)" : "1px solid rgba(255,255,255,0.025)",
                    borderRadius: 7,
                    color: isSelected ? "#111111" : inMonth ? "#F0F0F0" : "#E0E0E0",
                    opacity: inMonth ? 1 : 0.8,
                    fontSize: 17,
                    fontWeight: isSelected ? 600 : 500,
                  }}
                >
                  {isToday && !isSelected && <span className="absolute top-[7px] left-[8px] text-[9px] text-[#0A84FF]">TODAY</span>}
                  {date.getDate()}
                  {dayEvents.length > 0 && (
                    <span
                      className="absolute rounded-full"
                      style={{ bottom: 13, width: 5, height: 5, background: isSelected ? "#111111" : "#F0F0F0" }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT: selected day agenda + actions */}
        <div className="flex flex-col" style={{ background: "#131313", borderLeft: "1px solid rgba(255,255,255,0.07)", padding: "28px 26px" }}>
          <div className="text-[25px] font-semibold text-[#F5F5F7]">{selectedDayLabel}</div>
          <div className="text-[12px] text-[#8E8E93] mt-1">{selectedDayEvents.length} event{selectedDayEvents.length === 1 ? "" : "s"}</div>

          <div className="flex flex-col gap-[10px] mt-[18px] flex-1 overflow-y-auto">
            {selectedDayEvents.length === 0 ? (
              <div className="text-[13px] text-[#747474] mt-2">No events on this day.</div>
            ) : (
              selectedDayEvents.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setSelectedEventId(e.id)}
                  className="w-full text-left"
                  style={{
                    height: 48,
                    padding: "0 12px",
                    background: selectedEventId === e.id ? "#F1F1F1" : "#111111",
                    color: selectedEventId === e.id ? "#111111" : "#F5F5F7",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 500,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span className="truncate">{e.title}</span>
                  <span className="text-[11px] opacity-70 shrink-0 ml-2">{e.eventType === "follow_up" ? "Due" : new Date(e.startAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span>
                </button>
              ))
            )}
          </div>

          {selectedEvent && (
            <div className="flex flex-col gap-1.5 mb-3">
              {selectedEvent.leadId && (
                <Link href={`/team/leads/${selectedEvent.leadId}`} className="h-[36px] flex items-center justify-center gap-1.5 rounded-[7px] text-[12.5px]" style={{ background: "#1A1A1A", color: "#E8E8E8", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <BriefcaseBusiness size={13} /> Open Lead
                </Link>
              )}
              {selectedEvent.meetUrl && (
                <a href={selectedEvent.meetUrl} target="_blank" rel="noopener noreferrer" className="h-[36px] flex items-center justify-center gap-1.5 rounded-[7px] text-[12.5px]" style={{ background: "#1A1A1A", color: "#E8E8E8", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <ExternalLink size={13} /> Join / Open
                </a>
              )}
              <div className="flex gap-1.5">
                <button onClick={() => shareEvent(selectedEvent)} className="flex-1 h-[32px] flex items-center justify-center gap-1.5 rounded-[7px] text-[11.5px]" style={{ background: "#1A1A1A", color: "#D0D0D0", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <Download size={12} /> ICS
                </button>
                {selectedEvent.leadId && (
                  <button onClick={() => copyLink(selectedEvent)} className="flex-1 h-[32px] flex items-center justify-center gap-1.5 rounded-[7px] text-[11.5px]" style={{ background: "#1A1A1A", color: "#D0D0D0", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <Copy size={12} /> Copy Link
                  </button>
                )}
                {selectedEvent.source === "meeting" && selectedEvent.status === "booked" && (
                  <button onClick={() => cancelMeeting(selectedEvent)} disabled={busy} className="flex-1 h-[32px] flex items-center justify-center gap-1.5 rounded-[7px] text-[11.5px]" style={{ background: "#1A1A1A", color: "#FF6B6B", border: "1px solid rgba(255,69,58,0.2)" }}>
                    <Trash2 size={12} /> Cancel
                  </button>
                )}
                {selectedEvent.source === "personal_work" && selectedEvent.raw.owner_id === currentUser.id && (
                  <button onClick={() => deletePersonalEvent(selectedEvent)} disabled={busy} className="flex-1 h-[32px] flex items-center justify-center gap-1.5 rounded-[7px] text-[11.5px]" style={{ background: "#1A1A1A", color: "#FF6B6B", border: "1px solid rgba(255,69,58,0.2)" }}>
                    <Trash2 size={12} /> Delete
                  </button>
                )}
              </div>
            </div>
          )}

          <button
            onClick={() => setShowCreate(true)}
            className="h-[44px] rounded-[7px] font-semibold text-[13.5px] flex items-center justify-center gap-1.5"
            style={{ background: "#F1F1F1", color: "#111111" }}
          >
            <Plus size={14} /> Create Event
          </button>
        </div>
      </div>

      {showCreate && <CreateEventDrawer defaultDate={selectedDate} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); router.refresh(); }} />}
    </div>
  );
}

function MetaRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="grid items-center gap-2.5" style={{ gridTemplateColumns: "22px 1fr" }}>
      <Icon size={18} className="text-[#D0D0D0]" />
      <span className="text-[14px] text-[#E2E2E2]">
        <span className="text-[#8E8E93] mr-1.5">{label}:</span>
        {value}
      </span>
    </div>
  );
}

function CreateEventDrawer({ defaultDate, onClose, onCreated }: { defaultDate: string; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("09:30");
  const [calendarType, setCalendarType] = useState<"personal" | "work">("work");
  const [eventType, setEventType] = useState("task");
  const [location, setLocation] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [visibility, setVisibility] = useState("private");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const startAt = new Date(`${startDate}T${startTime}:00`).toISOString();
      const endAt = new Date(`${startDate}T${endTime}:00`).toISOString();
      const res = await fetch("/api/team/calendar-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, startAt, endAt, timezone, calendarType, eventType, location, externalMeetingUrl: externalUrl, visibility }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create event.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div className="h-full overflow-y-auto p-6" style={{ width: 420, background: "#181818", borderLeft: "1px solid rgba(255,255,255,0.08)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div className="text-[16px] font-semibold text-[#F5F5F7]">Create Event</div>
          <button onClick={onClose} className="text-[#6E6E73] hover:text-white">
            <X size={16} />
          </button>
        </div>
        <div className="flex flex-col gap-3">
          <Field label="Title">
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="sfb-field" />
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Date">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="sfb-field" />
            </Field>
            <Field label="Start">
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="sfb-field" />
            </Field>
            <Field label="End">
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="sfb-field" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Calendar">
              <select value={calendarType} onChange={(e) => setCalendarType(e.target.value as any)} className="sfb-field">
                <option value="work">Work</option>
                <option value="personal">Personal</option>
              </select>
            </Field>
            <Field label="Type">
              <select value={eventType} onChange={(e) => setEventType(e.target.value)} className="sfb-field">
                <option value="task">Task</option>
                <option value="reminder">Reminder</option>
                <option value="call">Call</option>
                <option value="demo">Demo</option>
                <option value="personal">Personal</option>
              </select>
            </Field>
          </div>
          <Field label="Description">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="sfb-field h-[70px] resize-none" />
          </Field>
          <Field label="Location">
            <input value={location} onChange={(e) => setLocation(e.target.value)} className="sfb-field" />
          </Field>
          <Field label="External Meeting URL">
            <input value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} className="sfb-field" placeholder="https://..." />
          </Field>
          <Field label="Visibility">
            <select value={visibility} onChange={(e) => setVisibility(e.target.value)} className="sfb-field">
              <option value="private">Private</option>
              <option value="company">Company</option>
            </select>
          </Field>
          {error && <p className="text-[12.5px] text-[#FF453A]">{error}</p>}
          <button onClick={submit} disabled={saving} className="h-[42px] rounded-[8px] bg-white text-black text-[13px] font-semibold disabled:opacity-60 flex items-center justify-center gap-1.5">
            {saving ? <Loader2 size={14} className="animate-spin" /> : null} {saving ? "Saving…" : "Create Event"}
          </button>
        </div>
        <style jsx global>{`
          .sfb-field {
            width: 100%;
            height: 38px;
            border-radius: 8px;
            padding: 0 10px;
            font-size: 13px;
            outline: none;
            background: #101010;
            border: 1px solid rgba(255, 255, 255, 0.08);
            color: #f5f5f7;
          }
        `}</style>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10.5px] uppercase tracking-wide text-[#6E6E73]">{label}</label>
      {children}
    </div>
  );
}
