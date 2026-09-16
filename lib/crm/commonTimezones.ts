// The distinct set of US timezones an employee would actually pick as
// their OWN home timezone -- a short, friendly-labeled list, backed by the
// real IANA identifier underneath (never the abbreviation as the stored
// value, per the "don't store EST/CST as canonical" rule).
export const COMMON_TIMEZONES: { iana: string; label: string; abbr: string }[] = [
  { iana: "America/New_York", label: "Eastern Time", abbr: "ET" },
  { iana: "America/Chicago", label: "Central Time", abbr: "CT" },
  { iana: "America/Denver", label: "Mountain Time", abbr: "MT" },
  { iana: "America/Phoenix", label: "Mountain Time (no DST — Arizona)", abbr: "MST" },
  { iana: "America/Los_Angeles", label: "Pacific Time", abbr: "PT" },
  { iana: "America/Anchorage", label: "Alaska Time", abbr: "AKT" },
  { iana: "Pacific/Honolulu", label: "Hawaii Time (no DST)", abbr: "HST" },
];

export function timezoneLabel(iana: string | null | undefined): string {
  if (!iana) return "Not set";
  const found = COMMON_TIMEZONES.find((t) => t.iana === iana);
  return found ? found.label : iana;
}
