"use client";

// Shared scheduling control used by Follow-Ups and Meetings: a real
// calendar date picker, a real hour/minute/AM-PM time picker, a
// "Business Time" vs "My Time" toggle, a business-timezone/state
// selector (pre-filled from the lead's verified location when available),
// and a dual-time preview showing both sides of the exact same instant.
//
// This is the ONE place scheduling UI lives -- Follow-Ups and Meetings
// both use it so there's a single source of truth for "how does a rep
// enter a time" instead of two independently-drifting implementations.
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { zonedTimeToUtcISO, formatDualTimezone, resolveBusinessTimezone, validateLocalDatetime } from "@/lib/crm/timezone";
import { US_STATE_TIMEZONES, findStateTimezone } from "@/lib/crm/usStateTimezones";

export type ScheduleValue = {
  dueAtUtc: string; // ISO instant -- the one canonical value everything downstream stores
  businessTimezone: string;
  creatorTimezone: string; // the acting employee's home timezone
  inputTimezone: string; // which one the rep actually typed into
  inputLocalDatetime: string; // "YYYY-MM-DD HH:MM" in inputTimezone
};

export default function ScheduleTimeZonePicker({
  employeeTimezone,
  leadCity,
  leadState,
  initialDateStr,
  initialTimeStr,
  onChange,
}: {
  employeeTimezone: string;
  leadCity?: string | null;
  leadState?: string | null;
  initialDateStr?: string;
  initialTimeStr?: string;
  onChange: (value: ScheduleValue | null) => void;
}) {
  const resolved = useMemo(() => resolveBusinessTimezone({ city: leadCity, state: leadState }), [leadCity, leadState]);

  const [mode, setMode] = useState<"business" | "mine">(resolved.timezone ? "business" : "mine");
  const [businessTz, setBusinessTz] = useState<string>(resolved.timezone || employeeTimezone);
  const [businessStateLabel, setBusinessStateLabel] = useState<string>(resolved.stateEntry?.abbr || "");
  const [needsConfirmation, setNeedsConfirmation] = useState(resolved.confidence === "low");

  const [date, setDate] = useState(initialDateStr || "");
  const [time, setTime] = useState(initialTimeStr || "");
  const [showCalendar, setShowCalendar] = useState(false);

  useEffect(() => {
    // Keep in sync if the lead's resolved location changes after mount
    // (e.g. research finishes loading after the modal is already open).
    if (resolved.timezone && mode === "business") {
      setBusinessTz(resolved.timezone);
      setBusinessStateLabel(resolved.stateEntry?.abbr || "");
      setNeedsConfirmation(resolved.confidence === "low");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved.timezone]);

  const inputTimezone = mode === "business" ? businessTz : employeeTimezone;
  const valid = validateLocalDatetime(date, time);

  const computed = useMemo(() => {
    if (!valid) return null;
    try {
      const dueAtUtc = zonedTimeToUtcISO(date, time, inputTimezone);
      return { dueAtUtc, dual: formatDualTimezone(dueAtUtc, businessTz, employeeTimezone) };
    } catch {
      return null;
    }
  }, [valid, date, time, inputTimezone, businessTz, employeeTimezone]);

  useEffect(() => {
    if (!computed) {
      onChange(null);
      return;
    }
    onChange({
      dueAtUtc: computed.dueAtUtc,
      businessTimezone: businessTz,
      creatorTimezone: employeeTimezone,
      inputTimezone,
      inputLocalDatetime: `${date} ${time}`,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computed, businessTz, employeeTimezone, inputTimezone, date, time]);

  return (
    <div className="flex flex-col gap-3">
      {/* Business Time / My Time toggle */}
      <div>
        <label className="text-[10.5px] uppercase tracking-wide text-[#6E6E73]">Time is in</label>
        <div className="mt-1 grid grid-cols-2 gap-1.5">
          {(["business", "mine"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className="h-[34px] rounded-[8px] text-[12.5px] font-medium transition-colors"
              style={{
                background: mode === m ? "#F5F5F7" : "#0A0A0A",
                color: mode === m ? "#111111" : "#A1A1A6",
                border: `1px solid ${mode === m ? "#F5F5F7" : "rgba(255,255,255,0.08)"}`,
              }}
            >
              {m === "business" ? "Business Time" : "My Time"}
            </button>
          ))}
        </div>
      </div>

      {/* Business state/timezone selector -- only relevant when entering business time */}
      {mode === "business" && (
        <div>
          <label className="text-[10.5px] uppercase tracking-wide text-[#6E6E73]">Business State</label>
          <select
            value={businessStateLabel}
            onChange={(e) => {
              const entry = findStateTimezone(e.target.value);
              setBusinessStateLabel(e.target.value);
              if (entry?.timezone) setBusinessTz(entry.timezone);
              setNeedsConfirmation(!!entry?.ambiguous);
            }}
            className="w-full mt-1 h-[38px] rounded-[8px] px-3 text-[13px] outline-none"
            style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" }}
          >
            <option value="">Select state…</option>
            {US_STATE_TIMEZONES.map((s) => (
              <option key={s.abbr} value={s.abbr}>
                {s.state}
              </option>
            ))}
          </select>
          {businessStateLabel && (
            <div className="text-[11.5px] text-[#6E6E73] mt-1">
              {findStateTimezone(businessStateLabel)?.label}
              {needsConfirmation && (
                <span className="text-[#FFD60A]"> — this state spans multiple timezones. Confirm the correct one below.</span>
              )}
            </div>
          )}
          {needsConfirmation && (
            <select
              value={businessTz}
              onChange={(e) => setBusinessTz(e.target.value)}
              className="w-full mt-1.5 h-[34px] rounded-[8px] px-3 text-[12.5px] outline-none"
              style={{ background: "#0A0A0A", border: "1px solid rgba(255,214,10,0.35)", color: "#F5F5F7" }}
            >
              <option value="America/New_York">Eastern Time</option>
              <option value="America/Chicago">Central Time</option>
              <option value="America/Denver">Mountain Time</option>
              <option value="America/Phoenix">Mountain Time (no DST)</option>
              <option value="America/Los_Angeles">Pacific Time</option>
            </select>
          )}
        </div>
      )}

      {/* Calendar date picker */}
      <div>
        <label className="text-[10.5px] uppercase tracking-wide text-[#6E6E73]">Date</label>
        <button
          type="button"
          onClick={() => setShowCalendar((v) => !v)}
          className="w-full mt-1 h-[38px] rounded-[8px] px-3 text-[13px] outline-none text-left"
          style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)", color: date ? "#F5F5F7" : "#6E6E73" }}
        >
          {date ? new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(new Date(`${date}T12:00:00`)) : "Choose a date"}
        </button>
        {showCalendar && (
          <MiniCalendar
            selected={date}
            onPick={(d) => {
              setDate(d);
              setShowCalendar(false);
            }}
          />
        )}
      </div>

      {/* Time picker */}
      <TimePicker value={time} onChange={setTime} />

      {/* Dual-time preview */}
      {computed && (
        <div className="rounded-[10px] p-3 mt-1" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-[#6E6E73]">Client Requested</div>
              <div className="text-[15px] font-semibold text-[#F5F5F7] mt-0.5">
                {computed.dual.businessTime} {computed.dual.businessTzLabel}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-[#6E6E73]">Your Time</div>
              <div className="text-[15px] font-semibold text-[#30D158] mt-0.5">
                {computed.dual.employeeTime} {computed.dual.employeeTzLabel}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MiniCalendar({ selected, onPick }: { selected: string; onPick: (dateStr: string) => void }) {
  const initial = selected ? new Date(`${selected}T12:00:00`) : new Date();
  const [calMonth, setCalMonth] = useState({ year: initial.getFullYear(), month: initial.getMonth() });
  const todayStr = new Intl.DateTimeFormat("en-CA").format(new Date());

  const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(calMonth.year, calMonth.month, 1));
  const firstDay = new Date(calMonth.year, calMonth.month, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(calMonth.year, calMonth.month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(startOffset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  function dateStrFor(day: number) {
    return new Intl.DateTimeFormat("en-CA").format(new Date(calMonth.year, calMonth.month, day));
  }

  return (
    <div className="mt-1.5 rounded-[10px] overflow-hidden" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.1)" }}>
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <button type="button" onClick={() => setCalMonth((m) => (m.month === 0 ? { year: m.year - 1, month: 11 } : { year: m.year, month: m.month - 1 }))}>
          <ChevronLeft size={14} color="#A1A1A6" />
        </button>
        <div className="text-[12.5px] text-[#F5F5F7]">{monthLabel}</div>
        <button type="button" onClick={() => setCalMonth((m) => (m.month === 11 ? { year: m.year + 1, month: 0 } : { year: m.year, month: m.month + 1 }))}>
          <ChevronRight size={14} color="#A1A1A6" />
        </button>
      </div>
      <div className="p-2.5">
        <div className="grid grid-cols-7 gap-1">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <div key={i} className="text-[9.5px] text-center text-[#66666A] font-semibold">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1 mt-1">
          {cells.map((day, i) => {
            if (day === null) return <div key={i} />;
            const ds = dateStrFor(day);
            const isToday = ds === todayStr;
            const isSelected = ds === selected;
            return (
              <button
                key={i}
                type="button"
                onClick={() => onPick(ds)}
                className="h-[28px] text-[11.5px] rounded-[7px]"
                style={{
                  background: isSelected ? "#F5F5F7" : "transparent",
                  color: isSelected ? "#111111" : "#D1D1D6",
                  border: isToday && !isSelected ? "1px solid rgba(255,255,255,0.2)" : "none",
                  fontWeight: isSelected ? 600 : 400,
                }}
              >
                {day}
              </button>
            );
          })}
        </div>
        <button type="button" onClick={() => onPick(todayStr)} className="w-full mt-2 h-[28px] rounded-[7px] text-[11px] text-[#A1A1A6]" style={{ background: "#151515" }}>
          Today
        </button>
      </div>
    </div>
  );
}

function TimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [h24, m] = value ? value.split(":").map(Number) : [9, 0];
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const ampm = h24 >= 12 ? "PM" : "AM";

  function set(nextH12: number, nextM: number, nextAmpm: "AM" | "PM") {
    let hh = nextH12 % 12;
    if (nextAmpm === "PM") hh += 12;
    onChange(`${String(hh).padStart(2, "0")}:${String(nextM).padStart(2, "0")}`);
  }

  return (
    <div>
      <label className="text-[10.5px] uppercase tracking-wide text-[#6E6E73]">Time</label>
      <div className="grid grid-cols-3 gap-1.5 mt-1">
        <select
          value={h12}
          onChange={(e) => set(+e.target.value, m, ampm)}
          className="h-[38px] rounded-[8px] px-2 text-[13px] outline-none text-center"
          style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" }}
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
        <select
          value={m}
          onChange={(e) => set(h12, +e.target.value, ampm)}
          className="h-[38px] rounded-[8px] px-2 text-[13px] outline-none text-center"
          style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" }}
        >
          {[0, 15, 30, 45].map((mm) => (
            <option key={mm} value={mm}>
              :{String(mm).padStart(2, "0")}
            </option>
          ))}
        </select>
        <select
          value={ampm}
          onChange={(e) => set(h12, m, e.target.value as "AM" | "PM")}
          className="h-[38px] rounded-[8px] px-2 text-[13px] outline-none text-center"
          style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" }}
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
    </div>
  );
}
