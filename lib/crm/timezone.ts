// ============================================================
// SFB Sales OS — centralized timezone/scheduling service.
//
// One rule this whole module exists to enforce: an employee should never
// have to do timezone arithmetic in their head. A follow-up/meeting is one
// real instant (stored in UTC); every surface (Follow-Ups, Meetings, CRM
// Calendar, Google Calendar, Google Meet, Call Workspace, notifications)
// reads that same instant and renders it in whichever timezone is relevant
// to what's being shown -- the employee's home timezone, or the business's
// resolved timezone. Every caller across the app MUST go through this file
// rather than inventing its own Date-object arithmetic (that duplication is
// exactly what let Follow-Ups quietly use the *browser's* detected
// timezone instead of anyone's actual configured one).
// ============================================================
import { findStateTimezone, type StateTimezoneEntry } from "./usStateTimezones";

// Converts a "wall clock" date+time in a given IANA timezone to a real UTC
// instant, using only built-in Intl (no date library dependency). Standard
// double-formatting trick: format a UTC guess back through the target zone,
// measure the drift, and correct for it.
function tzOffsetMinutes(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(dtf.formatToParts(date).map((p) => [p.type, p.value]));
  const hour = parts.hour === "24" ? "00" : parts.hour;
  const asIfUTC = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +hour, +parts.minute, +parts.second);
  return (asIfUTC - date.getTime()) / 60000;
}

/** dateStr: "YYYY-MM-DD", timeStr: "HH:MM" (24h, local to timeZone) */
export function zonedTimeToUtcISO(dateStr: string, timeStr: string, timeZone: string): string {
  const guess = new Date(`${dateStr}T${timeStr}:00Z`);
  const offset = tzOffsetMinutes(guess, timeZone);
  return new Date(guess.getTime() - offset * 60000).toISOString();
}

export function formatInTimeZone(iso: string, timeZone: string, opts?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, ...opts }).format(new Date(iso));
}

// A handful of well-known cities in states that genuinely span multiple
// timezones -- enough to resolve the common real cases (e.g. El Paso, TX is
// Mountain even though the rest of Texas is Central) without needing a full
// geocoding lookup. Anything not listed here, in an ambiguous state, must
// fall back to state_inference with low confidence rather than guess.
const CITY_TIMEZONE_OVERRIDES: Record<string, string> = {
  "el paso|tx": "America/Denver",
  "el paso|texas": "America/Denver",
  "amarillo|tx": "America/Chicago",
  "amarillo|texas": "America/Chicago",
  "pensacola|fl": "America/Chicago",
  "pensacola|florida": "America/Chicago",
  "panama city|fl": "America/Chicago",
  "panama city|florida": "America/Chicago",
  "knoxville|tn": "America/New_York",
  "knoxville|tennessee": "America/New_York",
  "chattanooga|tn": "America/New_York",
  "chattanooga|tennessee": "America/New_York",
  "memphis|tn": "America/Chicago",
  "memphis|tennessee": "America/Chicago",
  "nashville|tn": "America/Chicago",
  "nashville|tennessee": "America/Chicago",
};

export type TimezoneResolution = {
  timezone: string | null;
  source: "coordinates" | "verified_address" | "city_state" | "manual" | "state_inference" | null;
  confidence: "high" | "low" | null;
  label: string | null; // e.g. "Pacific Time"
  stateEntry: StateTimezoneEntry | null;
};

/** Resolves a business's timezone from the strongest available location
 * evidence, per the priority order in the spec: city+state override for
 * known-ambiguous states first, then the state's primary zone. NEVER
 * fabricates a confident answer for an ambiguous state without city-level
 * evidence -- callers MUST check `confidence` and prompt for an explicit
 * pick when it comes back "low". */
export function resolveBusinessTimezone(location: { city?: string | null; state?: string | null }): TimezoneResolution {
  const stateEntry = findStateTimezone(location.state);
  if (!stateEntry) return { timezone: null, source: null, confidence: null, label: null, stateEntry: null };

  if (location.city && stateEntry.ambiguous) {
    const key = `${location.city.trim().toLowerCase()}|${stateEntry.abbr.toLowerCase()}`;
    const keyFull = `${location.city.trim().toLowerCase()}|${stateEntry.state.toLowerCase()}`;
    const override = CITY_TIMEZONE_OVERRIDES[key] || CITY_TIMEZONE_OVERRIDES[keyFull];
    if (override) {
      return { timezone: override, source: "city_state", confidence: "high", label: stateEntry.label, stateEntry };
    }
  }

  if (stateEntry.ambiguous) {
    // A split state with no city-level match -- the majority zone is a
    // reasonable DEFAULT to show, but it must be flagged low-confidence so
    // the UI requires the rep to confirm/override rather than silently
    // trusting it (per "do not assume state always equals one timezone").
    return { timezone: stateEntry.timezone, source: "state_inference", confidence: "low", label: stateEntry.label, stateEntry };
  }

  return { timezone: stateEntry.timezone, source: "state_inference", confidence: "high", label: stateEntry.label, stateEntry };
}

export type DualTimeDisplay = {
  businessTime: string; // e.g. "4:00 PM"
  businessTzLabel: string; // e.g. "PT"
  employeeTime: string; // e.g. "7:00 PM"
  employeeTzLabel: string; // e.g. "ET"
  sameInstant: true;
};

function shortZoneAbbr(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" }).formatToParts(new Date(iso));
  return parts.find((p) => p.type === "timeZoneName")?.value ?? timeZone;
}

/** Formats one UTC instant in BOTH the business's and the employee's
 * timezone, for the "dual-time preview" every scheduling surface must
 * show. Both strings describe the exact same real instant. */
export function formatDualTimezone(utcIso: string, businessTimezone: string, employeeTimezone: string): DualTimeDisplay {
  return {
    businessTime: formatInTimeZone(utcIso, businessTimezone, { hour: "numeric", minute: "2-digit" }),
    businessTzLabel: shortZoneAbbr(utcIso, businessTimezone),
    employeeTime: formatInTimeZone(utcIso, employeeTimezone, { hour: "numeric", minute: "2-digit" }),
    employeeTzLabel: shortZoneAbbr(utcIso, employeeTimezone),
    sameInstant: true,
  };
}

/** True if dateStr/timeStr are a real, valid calendar date + wall-clock
 * time (rejects e.g. "2026-13-45" or "2026-02-30", not just the right
 * digit shape). Doesn't validate the timezone identifier itself (Intl
 * throws on that, which callers should catch). */
export function validateLocalDatetime(dateStr: string, timeStr: string): boolean {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  const timeMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(timeStr);
  if (!dateMatch || !timeMatch) return false;
  const [, y, mo, d] = dateMatch;
  // Constructing as UTC and reading the fields back is a cheap, reliable
  // real-calendar check: an out-of-range day (e.g. Feb 30) rolls over into
  // the next month in JS's Date, so the round-trip won't match.
  const dt = new Date(Date.UTC(+y, +mo - 1, +d));
  return dt.getUTCFullYear() === +y && dt.getUTCMonth() === +mo - 1 && dt.getUTCDate() === +d;
}
