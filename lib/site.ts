// Site-wide facts Roman supplied on 2026-10-12 (launch-list A-items + hours
// update 22:43 ET). One place, imported everywhere the public sees them. No
// imports here so legal documents, emails and client components can all use it.

/** The ONE support/contact address. Resend still sends FROM hello@sfbconnect.com (verified domain); replies go here. */
export const SUPPORT_EMAIL = "sfbconnectsupport@gmail.com";

export const LEGAL_ENTITY = "Six Figure Blueprints LLC, a Florida limited liability company";
export const LEGAL_ADDRESS = "1200 Brickell Ave, Miami, FL"; // as given by Roman 2026-10-12 — no suite/ZIP supplied
export const GOVERNING_LAW = "the State of Florida";

// ---- Hours (Roman, 2026-10-12 22:43 ET): ONE weekly schedule drives both the
// bookable demo slots and the "free for a call right now" callback window.
// Minutes after midnight, Eastern wall clock. A window is [start, end).
export type Window = { start: number; end: number };
const t = (h: number, m = 0) => h * 60 + m;
export const SCHEDULE_ET: { weekday: Window[]; weekend: Window[] } = {
  weekday: [{ start: t(8), end: t(8, 45) }, { start: t(11, 30) , end: t(18, 45) }], // 9:00–11:00 blocked (and 8:45–11:30 has no slot that fits)
  weekend: [{ start: t(8), end: t(15) }],
};
export const HOURS_LABEL = "Mon–Fri 8:00–8:45 AM & 11:30 AM–6:45 PM · Sat–Sun 8:00 AM–3:00 PM, Eastern";
export const CALLBACK_OWNER = "Roman";
/** Roman, 2026-10-12 23:10 ET: inside the window he calls back within 15–30 minutes. One string, used by prospect copy AND the internal owner alert. */
export const CALLBACK_WINDOW_MINUTES = "15–30";

/** Windows for an Eastern day-of-week (0 = Sunday). */
export const windowsFor = (dow: number): Window[] => (dow === 0 || dow === 6 ? SCHEDULE_ET.weekend : SCHEDULE_ET.weekday);

/** Pure: does a slot of `slotMinutes` starting at `startMin` (ET minutes) sit entirely inside a window that day? */
export const slotFits = (dow: number, startMin: number, slotMinutes: number): boolean =>
  windowsFor(dow).some((w) => startMin >= w.start && startMin + slotMinutes <= w.end);

const ET = "America/New_York";
function etNow(now: Date): { dow: number; minutes: number } {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: ET, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const g = (k: string) => p.find((x) => x.type === k)?.value ?? "";
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(g("weekday"));
  return { dow, minutes: Number(g("hour")) * 60 + Number(g("minute")) };
}

/** Pure: is the callback window open right now (Eastern wall clock)? Same windows as booking. */
export function callbackWindowOpen(now: Date = new Date()): boolean {
  const { dow, minutes } = etNow(now);
  return windowsFor(dow).some((w) => minutes >= w.start && minutes < w.end);
}

/**
 * What we actually do when a prospect ticks "free for a call right now": the team is alerted the instant
 * the booking lands; inside the window Roman calls back; outside it the call happens when we next open.
 * Not a guarantee and never worded as one.
 */
export function callbackPromise(now: Date = new Date()): string {
  return callbackWindowOpen(now)
    ? `${CALLBACK_OWNER} calls you back within ${CALLBACK_WINDOW_MINUTES} minutes. Keep your phone close.`
    : `We're outside our hours right now (${HOURS_LABEL}). ${CALLBACK_OWNER} will call you when we next open; your demo slot stays booked either way.`;
}

/** The checkbox hint in the booking modal. */
export function callbackHint(now: Date = new Date()): string {
  return callbackWindowOpen(now)
    ? `Tick this and ${CALLBACK_OWNER} calls you back within ${CALLBACK_WINDOW_MINUTES} minutes. Hours: ${HOURS_LABEL}.`
    : `Tick this and ${CALLBACK_OWNER} calls you first thing when we next open. Hours: ${HOURS_LABEL}.`;
}
