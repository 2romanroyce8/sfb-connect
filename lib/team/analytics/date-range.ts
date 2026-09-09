import type { AnalyticsRange, BucketGranularity } from "./types";

// One centralized place for every analytics range's day-count, bucket
// granularity, and label -- no chart or route should duplicate this math.
export const ANALYTICS_RANGES: { key: AnalyticsRange; label: string; days: number | null }[] = [
  { key: "1d", label: "1D", days: 1 },
  { key: "3d", label: "3D", days: 3 },
  { key: "5d", label: "5D", days: 5 },
  { key: "7d", label: "7D", days: 7 },
  { key: "30d", label: "30D", days: 30 },
  { key: "3m", label: "3M", days: 90 },
  { key: "6m", label: "6M", days: 180 },
  { key: "12m", label: "12M", days: 365 },
  { key: "all", label: "ALL", days: null },
];

export function isAnalyticsRange(v: unknown): v is AnalyticsRange {
  return typeof v === "string" && ANALYTICS_RANGES.some((r) => r.key === v);
}

export function getRangeDays(range: AnalyticsRange): number | null {
  return ANALYTICS_RANGES.find((r) => r.key === range)?.days ?? 30;
}

export function getBucketGranularity(range: AnalyticsRange): BucketGranularity {
  switch (range) {
    case "1d":
    case "3d":
      return "hour";
    case "5d":
    case "7d":
    case "30d":
      return "day";
    case "3m":
    case "6m":
      return "week";
    case "12m":
    case "all":
    default:
      return "month";
  }
}

/** Inclusive of "today" -- a 7d range spans today and the 6 days before it. */
export function getRangeStart(range: AnalyticsRange, earliestFallback: Date): Date {
  const days = getRangeDays(range);
  if (days === null) {
    const d = new Date(earliestFallback);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const d = new Date();
  d.setDate(d.getDate() - (days - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Null for "all" -- there's no meaningful "previous period" to compare an
 * unbounded range against. */
export function getPreviousRangeBounds(range: AnalyticsRange, currentStart: Date): { start: Date; end: Date } | null {
  const days = getRangeDays(range);
  if (days === null) return null;
  const end = new Date(currentStart.getTime() - 1);
  const start = new Date(currentStart);
  start.setDate(start.getDate() - days);
  return { start, end };
}

type Bucket = { key: string; label: string; sortMs: number };

function truncate(d: Date, granularity: BucketGranularity): Date {
  const t = new Date(d);
  if (granularity === "hour") {
    t.setMinutes(0, 0, 0);
  } else if (granularity === "day") {
    t.setHours(0, 0, 0, 0);
  } else if (granularity === "week") {
    t.setHours(0, 0, 0, 0);
    t.setDate(t.getDate() - t.getDay());
  } else {
    t.setHours(0, 0, 0, 0);
    t.setDate(1);
  }
  return t;
}

function step(d: Date, granularity: BucketGranularity): Date {
  const t = new Date(d);
  if (granularity === "hour") t.setHours(t.getHours() + 1);
  else if (granularity === "day") t.setDate(t.getDate() + 1);
  else if (granularity === "week") t.setDate(t.getDate() + 7);
  else t.setMonth(t.getMonth() + 1);
  return t;
}

function labelFor(d: Date, granularity: BucketGranularity): string {
  if (granularity === "hour") return d.toLocaleTimeString(undefined, { hour: "numeric" });
  if (granularity === "day") return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (granularity === "week") return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

/** Generates every bucket boundary from start to end (inclusive), oldest
 * first -- a standard chronological analytics timeline, deliberately NOT
 * the "today on the left" ordering used by the small dashboard widget. */
export function generateBuckets(start: Date, end: Date, granularity: BucketGranularity): Bucket[] {
  const buckets: Bucket[] = [];
  let cursor = truncate(start, granularity);
  const endTrunc = truncate(end, granularity);
  let guard = 0;
  while (cursor.getTime() <= endTrunc.getTime() && guard < 400) {
    buckets.push({ key: cursor.toISOString(), label: labelFor(cursor, granularity), sortMs: cursor.getTime() });
    cursor = step(cursor, granularity);
    guard++;
  }
  return buckets;
}

/** Maps an event's occurred_at timestamp to the bucket key it belongs in. */
export function bucketKeyFor(dateIso: string, granularity: BucketGranularity): string {
  return truncate(new Date(dateIso), granularity).toISOString();
}
