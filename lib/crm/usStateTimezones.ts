// US state -> IANA timezone resolution table. A state is a convenient UI
// selector, NOT the scheduling truth -- several real states span multiple
// timezones, and this table says so explicitly rather than silently
// picking one and risking a wrong conversion. Callers MUST check
// `ambiguous` and require city/ZIP/coordinate precision (or an explicit
// manual timezone pick) before trusting a state-only resolution for an
// ambiguous state.
export type StateTimezoneEntry = {
  state: string; // full name, as commonly stored on a lead (e.g. "California")
  abbr: string;
  timezone: string | null; // primary/majority IANA zone, or null if too split to have one
  label: string; // e.g. "Pacific Time"
  ambiguous: boolean; // true if a meaningful part of the state is in a DIFFERENT zone
};

// Primary zone listed is the one covering the large majority of the
// state's population/area. `ambiguous: true` states genuinely need
// city/ZIP precision or an explicit rep override -- never silently
// resolved from the state name alone for those.
export const US_STATE_TIMEZONES: StateTimezoneEntry[] = [
  { state: "Alabama", abbr: "AL", timezone: "America/Chicago", label: "Central Time", ambiguous: false },
  { state: "Alaska", abbr: "AK", timezone: "America/Anchorage", label: "Alaska Time", ambiguous: true }, // Aleutian Islands are Hawaii-Aleutian time
  { state: "Arizona", abbr: "AZ", timezone: "America/Phoenix", label: "Mountain Time (no DST)", ambiguous: false }, // Navajo Nation portion observes DST, but that's a small area
  { state: "Arkansas", abbr: "AR", timezone: "America/Chicago", label: "Central Time", ambiguous: false },
  { state: "California", abbr: "CA", timezone: "America/Los_Angeles", label: "Pacific Time", ambiguous: false },
  { state: "Colorado", abbr: "CO", timezone: "America/Denver", label: "Mountain Time", ambiguous: false },
  { state: "Connecticut", abbr: "CT", timezone: "America/New_York", label: "Eastern Time", ambiguous: false },
  { state: "Delaware", abbr: "DE", timezone: "America/New_York", label: "Eastern Time", ambiguous: false },
  { state: "Florida", abbr: "FL", timezone: "America/New_York", label: "Eastern Time", ambiguous: true }, // western Panhandle (west of the Apalachicola River) is Central
  { state: "Georgia", abbr: "GA", timezone: "America/New_York", label: "Eastern Time", ambiguous: false },
  { state: "Hawaii", abbr: "HI", timezone: "Pacific/Honolulu", label: "Hawaii Time (no DST)", ambiguous: false },
  { state: "Idaho", abbr: "ID", timezone: "America/Boise", label: "Mountain Time", ambiguous: true }, // northern Idaho panhandle is Pacific
  { state: "Illinois", abbr: "IL", timezone: "America/Chicago", label: "Central Time", ambiguous: false },
  { state: "Indiana", abbr: "IN", timezone: "America/Indiana/Indianapolis", label: "Eastern Time", ambiguous: true }, // several NW/SW counties are Central
  { state: "Iowa", abbr: "IA", timezone: "America/Chicago", label: "Central Time", ambiguous: false },
  { state: "Kansas", abbr: "KS", timezone: "America/Chicago", label: "Central Time", ambiguous: true }, // western Kansas counties are Mountain
  { state: "Kentucky", abbr: "KY", timezone: "America/New_York", label: "Eastern Time", ambiguous: true }, // western Kentucky is Central
  { state: "Louisiana", abbr: "LA", timezone: "America/Chicago", label: "Central Time", ambiguous: false },
  { state: "Maine", abbr: "ME", timezone: "America/New_York", label: "Eastern Time", ambiguous: false },
  { state: "Maryland", abbr: "MD", timezone: "America/New_York", label: "Eastern Time", ambiguous: false },
  { state: "Massachusetts", abbr: "MA", timezone: "America/New_York", label: "Eastern Time", ambiguous: false },
  { state: "Michigan", abbr: "MI", timezone: "America/Detroit", label: "Eastern Time", ambiguous: true }, // western Upper Peninsula counties are Central
  { state: "Minnesota", abbr: "MN", timezone: "America/Chicago", label: "Central Time", ambiguous: false },
  { state: "Mississippi", abbr: "MS", timezone: "America/Chicago", label: "Central Time", ambiguous: false },
  { state: "Missouri", abbr: "MO", timezone: "America/Chicago", label: "Central Time", ambiguous: false },
  { state: "Montana", abbr: "MT", timezone: "America/Denver", label: "Mountain Time", ambiguous: false },
  { state: "Nebraska", abbr: "NE", timezone: "America/Chicago", label: "Central Time", ambiguous: true }, // western Nebraska panhandle is Mountain
  { state: "Nevada", abbr: "NV", timezone: "America/Los_Angeles", label: "Pacific Time", ambiguous: true }, // a few eastern counties are Mountain
  { state: "New Hampshire", abbr: "NH", timezone: "America/New_York", label: "Eastern Time", ambiguous: false },
  { state: "New Jersey", abbr: "NJ", timezone: "America/New_York", label: "Eastern Time", ambiguous: false },
  { state: "New Mexico", abbr: "NM", timezone: "America/Denver", label: "Mountain Time", ambiguous: false },
  { state: "New York", abbr: "NY", timezone: "America/New_York", label: "Eastern Time", ambiguous: false },
  { state: "North Carolina", abbr: "NC", timezone: "America/New_York", label: "Eastern Time", ambiguous: false },
  { state: "North Dakota", abbr: "ND", timezone: "America/Chicago", label: "Central Time", ambiguous: true }, // southwestern counties are Mountain
  { state: "Ohio", abbr: "OH", timezone: "America/New_York", label: "Eastern Time", ambiguous: false },
  { state: "Oklahoma", abbr: "OK", timezone: "America/Chicago", label: "Central Time", ambiguous: false },
  { state: "Oregon", abbr: "OR", timezone: "America/Los_Angeles", label: "Pacific Time", ambiguous: true }, // Malheur County (far east) is Mountain
  { state: "Pennsylvania", abbr: "PA", timezone: "America/New_York", label: "Eastern Time", ambiguous: false },
  { state: "Rhode Island", abbr: "RI", timezone: "America/New_York", label: "Eastern Time", ambiguous: false },
  { state: "South Carolina", abbr: "SC", timezone: "America/New_York", label: "Eastern Time", ambiguous: false },
  { state: "South Dakota", abbr: "SD", timezone: "America/Chicago", label: "Central Time", ambiguous: true }, // western SD is Mountain
  { state: "Tennessee", abbr: "TN", timezone: "America/Chicago", label: "Central Time", ambiguous: true }, // eastern third (Knoxville, Chattanooga) is Eastern
  { state: "Texas", abbr: "TX", timezone: "America/Chicago", label: "Central Time", ambiguous: true }, // El Paso area (far west) is Mountain
  { state: "Utah", abbr: "UT", timezone: "America/Denver", label: "Mountain Time", ambiguous: false },
  { state: "Vermont", abbr: "VT", timezone: "America/New_York", label: "Eastern Time", ambiguous: false },
  { state: "Virginia", abbr: "VA", timezone: "America/New_York", label: "Eastern Time", ambiguous: false },
  { state: "Washington", abbr: "WA", timezone: "America/Los_Angeles", label: "Pacific Time", ambiguous: false },
  { state: "West Virginia", abbr: "WV", timezone: "America/New_York", label: "Eastern Time", ambiguous: false },
  { state: "Wisconsin", abbr: "WI", timezone: "America/Chicago", label: "Central Time", ambiguous: false },
  { state: "Wyoming", abbr: "WY", timezone: "America/Denver", label: "Mountain Time", ambiguous: false },
  { state: "District of Columbia", abbr: "DC", timezone: "America/New_York", label: "Eastern Time", ambiguous: false },
];

const BY_NAME = new Map(US_STATE_TIMEZONES.map((s) => [s.state.toLowerCase(), s]));
const BY_ABBR = new Map(US_STATE_TIMEZONES.map((s) => [s.abbr.toLowerCase(), s]));

/** Looks up by full name ("California") or 2-letter abbreviation ("CA"),
 * case-insensitive. Returns null for anything unrecognized -- never guesses. */
export function findStateTimezone(stateInput: string | null | undefined): StateTimezoneEntry | null {
  if (!stateInput) return null;
  const key = stateInput.trim().toLowerCase();
  return BY_NAME.get(key) || BY_ABBR.get(key) || null;
}
