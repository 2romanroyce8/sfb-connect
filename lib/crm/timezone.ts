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
