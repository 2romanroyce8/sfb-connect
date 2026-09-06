"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ArrowUpRight, Loader2, CalendarDays } from "lucide-react";

type FlatSlot = { startISO: string; endISO: string; dayNumber: string; monthAbbr: string; weekday: string; timeLabel: string; status: "AVAILABLE" | "LIMITED" };
type DaySlot = { startISO: string; endISO: string; timeLabel: string };
type Selected = { startISO: string; endISO: string } | null;

const DURATIONS = [15, 30, 45, 60];
const GENERIC_TIMES = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30"];

const STATUS_COLOR: Record<string, string> = { AVAILABLE: "#30D158", LIMITED: "#FFD60A" };

export default function MeetingAvailabilityPicker({
  leadId,
  duration,
  onDurationChange,
  selected,
  onSelect,
  timeZone,
}: {
  leadId: string;
  duration: number;
  onDurationChange: (d: number) => void;
  selected: Selected;
  onSelect: (startISO: string, endISO: string) => void;
  timeZone: string;
}) {
  const [loading, setLoading] = useState(true);
  const [googleConnected, setGoogleConnected] = useState<boolean | null>(null);
  const [slots, setSlots] = useState<FlatSlot[]>([]);
  const [quickFilter, setQuickFilter] = useState<"all" | "today" | "tomorrow" | "week">("all");
  const [expanded, setExpanded] = useState(false);
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [customDate, setCustomDate] = useState<string | null>(null);
  const [customDaySlots, setCustomDaySlots] = useState<DaySlot[]>([]);
  const [customLoading, setCustomLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/team/leads/${leadId}/meetings/available-slots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ durationMinutes: duration, timeZone }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setGoogleConnected(!!data.googleConnected);
        setSlots(data.slots || []);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [leadId, duration, timeZone]);

  const now = new Date();
  const todayStr = now.toDateString();
  const tomorrowStr = new Date(now.getTime() + 86400000).toDateString();
  const weekEnd = now.getTime() + 7 * 86400000;

  const filteredSlots = useMemo(() => {
    if (quickFilter === "all") return slots;
    return slots.filter((s) => {
      const d = new Date(s.startISO);
      if (quickFilter === "today") return d.toDateString() === todayStr;
      if (quickFilter === "tomorrow") return d.toDateString() === tomorrowStr;
      if (quickFilter === "week") return d.getTime() <= weekEnd;
      return true;
    });
  }, [slots, quickFilter]);

  async function loadCustomDay(dateStr: string) {
    setCustomDate(dateStr);
    setExpanded(false);
    if (googleConnected === false) {
      // Honest manual mode -- these are NOT verified availability, just
      // common time options, and are never labeled "Available".
      setCustomDaySlots(
        GENERIC_TIMES.map((t) => {
          const [h, m] = t.split(":");
          const label = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(2000, 0, 1, +h, +m));
          return { startISO: `${dateStr}T${t}`, endISO: `${dateStr}T${t}`, timeLabel: label };
        })
      );
      return;
    }
    setCustomLoading(true);
    try {
      const res = await fetch(`/api/team/leads/${leadId}/meetings/available-slots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ durationMinutes: duration, timeZone, date: dateStr }),
      });
      const data = await res.json();
      setCustomDaySlots(data.slots || []);
    } finally {
      setCustomLoading(false);
    }
  }

  function pickCustomTime(slot: DaySlot) {
    if (googleConnected === false) {
      // Manual mode: build startISO/endISO from the local wall-clock time
      // the rep picked, since we have no server-verified slot to trust.
      const start = new Date(`${slot.startISO}:00`);
      const end = new Date(start.getTime() + duration * 60000);
      onSelect(start.toISOString(), end.toISOString());
    } else {
      onSelect(slot.startISO, slot.endISO);
    }
  }

  return (
    <div style={{ width: "100%", background: "#121212", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, overflow: "hidden" }}>
      {expanded ? (
        <ExpandedMonthCalendar
          calMonth={calMonth}
          setCalMonth={setCalMonth}
          timeZone={timeZone}
          onPick={loadCustomDay}
          onClose={() => setExpanded(false)}
        />
      ) : (
        <div style={{ padding: 10 }}>
          {/* Quick date filters */}
          <div className="flex items-center gap-2 flex-wrap" style={{ padding: "4px 2px 8px" }}>
            {(["Today", "Tomorrow", "This Week"] as const).map((label, i) => {
              const key = (["today", "tomorrow", "week"] as const)[i];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setQuickFilter(quickFilter === key ? "all" : key)}
                  style={{
                    height: 32,
                    padding: "0 12px",
                    borderRadius: 8,
                    background: quickFilter === key ? "#1F1F1F" : "#151515",
                    border: `1px solid ${quickFilter === key ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.06)"}`,
                    fontSize: 11,
                    color: quickFilter === key ? "#F5F5F7" : "#A1A1A6",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {googleConnected === false && (
            <div className="mx-0.5 mb-2 text-[11.5px] rounded-[8px] p-2.5" style={{ background: "rgba(255,214,10,0.08)", color: "#FFD60A" }}>
              Google Calendar isn't connected — availability below is not verified.{" "}
              <a href="/team/integrations" className="underline">
                Connect it
              </a>{" "}
              to see real openings.
            </div>
          )}

          {customDate ? (
            <CustomDayTimeGrid
              dateStr={customDate}
              slots={customDaySlots}
              loading={customLoading}
              selected={selected}
              verified={googleConnected === true}
              onPick={pickCustomTime}
              onBack={() => setCustomDate(null)}
            />
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 300, overflowY: "auto", padding: "0 2px" }}>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 size={18} className="animate-spin text-[#6E6E73]" />
                  </div>
                ) : googleConnected === false ? (
                  <div className="text-[12.5px] text-[#6E6E73] px-1 py-3">Connect Google Calendar to see upcoming availability, or choose a date manually below.</div>
                ) : filteredSlots.length === 0 ? (
                  <div className="text-[12.5px] text-[#6E6E73] px-1 py-3">No open slots found in this range — try "Choose another date".</div>
                ) : (
                  filteredSlots.map((s) => {
                    const isSelected = selected?.startISO === s.startISO;
                    return (
                      <button
                        key={s.startISO}
                        type="button"
                        onClick={() => onSelect(s.startISO, s.endISO)}
                        style={{
                          position: "relative",
                          minHeight: 70,
                          display: "grid",
                          gridTemplateColumns: "58px minmax(0,1fr) auto",
                          alignItems: "center",
                          gap: 12,
                          padding: "10px 12px 10px 16px",
                          background: isSelected ? "#1C1C1C" : "#151515",
                          border: `1px solid ${isSelected ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.055)"}`,
                          borderRadius: 13,
                          cursor: "pointer",
                          transition: "background 150ms ease, border-color 150ms ease",
                          textAlign: "left",
                        }}
                      >
                        {isSelected && <span style={{ position: "absolute", left: 0, top: 10, bottom: 10, width: 3, background: "#30D158", borderRadius: 3 }} />}
                        <div className="flex flex-col items-center justify-center">
                          <span style={{ fontSize: 18, fontWeight: 600, color: isSelected ? "#FFFFFF" : "#F5F5F7" }}>{s.dayNumber}</span>
                          <span style={{ fontSize: 10, fontWeight: 500, textTransform: "uppercase", color: "#6E6E73", marginTop: 2 }}>{s.monthAbbr}</span>
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 500, color: isSelected ? "#FFFFFF" : "#ECECEC" }}>
                            {s.weekday} · {s.timeLabel}
                          </div>
                          <div style={{ fontSize: 11, color: "#77777C", marginTop: 4, display: "flex", alignItems: "center", gap: 5 }}>
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: STATUS_COLOR[s.status] }} />
                            {duration} min · {s.status === "AVAILABLE" ? "Available" : "Limited"}
                          </div>
                        </div>
                        <ArrowUpRight size={17} color="#77777C" />
                      </button>
                    );
                  })
                )}
              </div>

              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="flex items-center gap-1.5"
                style={{ marginTop: 10, padding: "8px 6px", fontSize: 12, color: "#A1A1A6" }}
              >
                <CalendarDays size={13} /> Choose another date
              </button>
            </>
          )}

          {/* Duration selector */}
          <div style={{ marginTop: 12, padding: "0 2px" }}>
            <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em", color: "#6E6E73", marginBottom: 6 }}>Duration</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 8 }}>
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => onDurationChange(d)}
                  style={{
                    height: 38,
                    background: duration === d ? "#F5F5F7" : "#151515",
                    border: `1px solid ${duration === d ? "#F5F5F7" : "rgba(255,255,255,0.06)"}`,
                    borderRadius: 10,
                    fontSize: 12,
                    color: duration === d ? "#111111" : "#D1D1D6",
                    fontWeight: duration === d ? 600 : 400,
                  }}
                >
                  {d} min
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 10, padding: "0 4px", fontSize: 11, color: "#6E6E73" }}>Timezone: {timeZone}</div>
        </div>
      )}
    </div>
  );
}

function CustomDayTimeGrid({
  dateStr,
  slots,
  loading,
  selected,
  verified,
  onPick,
  onBack,
}: {
  dateStr: string;
  slots: DaySlot[];
  loading: boolean;
  selected: Selected;
  verified: boolean;
  onPick: (slot: DaySlot) => void;
  onBack: () => void;
}) {
  const dateLabel = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date(`${dateStr}T12:00:00`));
  return (
    <div style={{ padding: "4px 2px" }}>
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={onBack} className="flex items-center gap-1 text-[11.5px] text-[#A1A1A6] hover:text-white">
          <ChevronLeft size={13} /> Back
        </button>
        <div style={{ fontSize: 13, color: "#F5F5F7" }}>{dateLabel}</div>
      </div>
      {!verified && <div className="text-[11px] text-[#6E6E73] mb-2 px-0.5">Not verified against a calendar — pick a common time.</div>}
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 size={16} className="animate-spin text-[#6E6E73]" />
        </div>
      ) : slots.length === 0 ? (
        <div className="text-[12px] text-[#6E6E73] py-4 px-1">No open times found this day.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 8, maxHeight: 220, overflowY: "auto" }}>
          {slots.map((s) => {
            // Verified slots' startISO matches exactly. Manual (unverified)
            // slots get converted to a real ISO the moment they're picked,
            // so this exact match only lights up for the verified path --
            // a cosmetic limitation, not a booking-correctness issue (the
            // click still calls onSelect with a valid time either way).
            const isSelected = selected?.startISO === s.startISO;
            return (
              <button
                key={s.startISO}
                type="button"
                onClick={() => onPick(s)}
                style={{
                  height: 42,
                  background: isSelected ? "#F5F5F7" : "#151515",
                  border: `1px solid ${isSelected ? "#F5F5F7" : "rgba(255,255,255,0.06)"}`,
                  borderRadius: 10,
                  fontSize: 12,
                  color: isSelected ? "#111111" : "#D1D1D6",
                }}
              >
                {s.timeLabel}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ExpandedMonthCalendar({
  calMonth,
  setCalMonth,
  timeZone,
  onPick,
  onClose,
}: {
  calMonth: { year: number; month: number };
  setCalMonth: (m: { year: number; month: number }) => void;
  timeZone: string;
  onPick: (dateStr: string) => void;
  onClose: () => void;
}) {
  const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(calMonth.year, calMonth.month, 1));
  const today = new Date();
  const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone }).format(today);

  const firstDay = new Date(calMonth.year, calMonth.month, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(calMonth.year, calMonth.month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(startOffset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  function dateStrFor(day: number) {
    const d = new Date(calMonth.year, calMonth.month, day);
    return new Intl.DateTimeFormat("en-CA").format(d);
  }

  function isPast(day: number) {
    return dateStrFor(day) < todayStr;
  }

  return (
    <div>
      <div style={{ height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", background: "#171717", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <button type="button" onClick={onClose} className="flex items-center gap-1 text-[11.5px] text-[#A1A1A6] hover:text-white">
          <ChevronLeft size={13} /> Back
        </button>
        <div style={{ fontSize: 16, fontWeight: 600, color: "#F5F5F7" }}>{monthLabel}</div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            onClick={() => setCalMonth(calMonth.month === 0 ? { year: calMonth.year - 1, month: 11 } : { year: calMonth.year, month: calMonth.month - 1 })}
            style={{ width: 36, height: 36, borderRadius: 10, background: "transparent", border: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <ChevronLeft size={15} color="#A1A1A6" />
          </button>
          <button
            type="button"
            onClick={() => setCalMonth(calMonth.month === 11 ? { year: calMonth.year + 1, month: 0 } : { year: calMonth.year, month: calMonth.month + 1 })}
            style={{ width: 36, height: 36, borderRadius: 10, background: "transparent", border: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <ChevronRight size={15} color="#A1A1A6" />
          </button>
        </div>
      </div>

      <div style={{ background: "#121212", padding: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: 4 }}>
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <div key={i} style={{ fontSize: 10, fontWeight: 600, color: "#66666A", textAlign: "center" }}>
              {d}
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: 4, marginTop: 8 }}>
          {cells.map((day, i) => {
            if (day === null) return <div key={i} />;
            const past = isPast(day);
            const isToday = dateStrFor(day) === todayStr;
            return (
              <button
                key={i}
                type="button"
                disabled={past}
                onClick={() => onPick(dateStrFor(day))}
                style={{
                  height: 38,
                  minWidth: 0,
                  background: "transparent",
                  border: isToday ? "1px solid rgba(255,255,255,0.15)" : "none",
                  borderRadius: 9,
                  fontSize: 12,
                  color: past ? "#454549" : "#D1D1D6",
                  cursor: past ? "not-allowed" : "pointer",
                }}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
