// Period boundaries for the leaderboard. Uses America/New_York, matching
// the timezone default already used elsewhere in this codebase
// (crm_followups.timezone, crm_meetings.timezone) -- a real per-company
// configurable timezone (spec section 63) is deferred, this is documented
// as a simplification rather than silently defaulting to UTC (which would
// shift "today" by hours and misrepresent competition boundaries).
const COMPANY_TZ = "America/New_York";

function nowInTz(tz: string): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: tz }));
}

function tzOffsetMs(tz: string): number {
  return new Date().getTime() - nowInTz(tz).getTime();
}

function startOfDayInTz(tz: string): Date {
  const local = nowInTz(tz);
  const localMidnight = new Date(local.getFullYear(), local.getMonth(), local.getDate());
  return new Date(localMidnight.getTime() + tzOffsetMs(tz));
}

export type LeaderboardPeriod = "today" | "week" | "month" | "all";

export function getPeriodBounds(period: LeaderboardPeriod): { start: Date; end: Date } {
  const end = new Date(Date.now() + 24 * 60 * 60 * 1000); // generous upper bound, never excludes "now"
  const todayStart = startOfDayInTz(COMPANY_TZ);

  if (period === "today") return { start: todayStart, end };

  if (period === "week") {
    const local = nowInTz(COMPANY_TZ);
    const dow = local.getDay(); // 0=Sun..6=Sat
    const daysSinceMonday = (dow + 6) % 7; // week starts Monday
    const start = new Date(todayStart.getTime() - daysSinceMonday * 24 * 60 * 60 * 1000);
    return { start, end };
  }

  if (period === "month") {
    const local = nowInTz(COMPANY_TZ);
    const firstOfMonth = new Date(local.getFullYear(), local.getMonth(), 1);
    const start = new Date(firstOfMonth.getTime() + tzOffsetMs(COMPANY_TZ));
    return { start, end };
  }

  // all-time
  return { start: new Date(0), end };
}
