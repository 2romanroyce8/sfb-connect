// Site-wide facts Roman supplied on 2026-10-12 (launch-list A-items). One
// place, imported everywhere the public sees them. No imports here so legal
// documents, emails and client components can all use it.

/** The ONE support/contact address. Resend still sends FROM hello@sfbconnect.com (verified domain); replies go here. */
export const SUPPORT_EMAIL = "sfbconnectsupport@gmail.com";

export const LEGAL_ENTITY = "Six Figure Blueprints LLC, a Florida limited liability company";
export const LEGAL_ADDRESS = "1200 Brickell Ave, Miami, FL"; // as given by Roman 2026-10-12 — no suite/ZIP supplied
export const GOVERNING_LAW = "the State of Florida";

/** Who carries the callback phone and when (Eastern). Roman, 2026-10-12. */
export const CALLBACK_OWNER = "Roman";
export const CALLBACK_HOURS_ET = { start: { h: 11, m: 30 }, end: { h: 21, m: 45 } } as const;
export const CALLBACK_HOURS_LABEL = "11:30 AM–9:45 PM Eastern";

const ET = "America/New_York";
function etMinutes(now: Date): number {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: ET, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const g = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0);
  return g("hour") * 60 + g("minute");
}

/** Pure: is the callback window open right now (Eastern wall clock)? Inclusive start, exclusive end. */
export function callbackWindowOpen(now: Date = new Date()): boolean {
  const m = etMinutes(now);
  return m >= CALLBACK_HOURS_ET.start.h * 60 + CALLBACK_HOURS_ET.start.m && m < CALLBACK_HOURS_ET.end.h * 60 + CALLBACK_HOURS_ET.end.m;
}

/**
 * What we actually do when a prospect ticks "free for a call right now": the team is alerted the instant
 * the booking lands; inside the window Roman calls back; outside it the call happens when the window opens.
 * Not a guarantee and never worded as one.
 */
export function callbackPromise(now: Date = new Date()): string {
  return callbackWindowOpen(now)
    ? `${CALLBACK_OWNER} calls you back right away — usually within a few minutes. Keep your phone close.`
    : `Our callback hours are ${CALLBACK_HOURS_LABEL}. ${CALLBACK_OWNER} will call you when they open; your demo slot stays booked either way.`;
}

/** The checkbox hint in the booking modal. */
export function callbackHint(now: Date = new Date()): string {
  return callbackWindowOpen(now)
    ? `Tick this and ${CALLBACK_OWNER} calls you back right away — usually within a few minutes. Callback hours: ${CALLBACK_HOURS_LABEL}.`
    : `Tick this and ${CALLBACK_OWNER} calls you first thing in our callback hours, ${CALLBACK_HOURS_LABEL}.`;
}
