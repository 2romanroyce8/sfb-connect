// Send windows: a campaign's approved emails only leave inside a chosen time
// window. Before the window, an approved send is HELD (status stays
// "approved", a send_held event is logged) and the hourly outbound sync
// releases it once the window is open. After the window has passed, nothing
// is auto-released; leftovers can still be sent by hand.
//
// Scoped by template so customer businesses and every other email (replies,
// booking confirmations, follow-ups) are unaffected. Pure, so it is tested.

export type SendWindow = { id: string; label: string; startISO: string; endISO: string; templateKeys: string[] };

// Rome, 2026-10-19: roofing pilot intro goes out Monday Oct 19, 6–9 PM Eastern.
// The hourly sync runs at :15 UTC → releases at 6:15, 7:15 and 8:15 PM ET.
export const SEND_WINDOWS: SendWindow[] = [
  {
    id: "roofing-pilot-2026-10-19",
    label: "Mon Oct 19, 6–9 PM ET",
    startISO: "2026-10-19T18:00:00-04:00",
    endISO: "2026-10-19T21:00:00-04:00",
    templateKeys: ["sfb_roofing_missed_calls"],
  },
];

/** Max emails one business releases per hourly tick (keeps a fresh Gmail account clear of burst-sending flags). */
export const RELEASE_CAP_PER_TICK = 40;

export type WindowState = { state: "none" } | { state: "before" | "open" | "after"; window: SendWindow };

/** The window governing a message's template right now. Of several windows for one template, the current or next one wins. */
export function sendWindowState(templateKey: string | null | undefined, now: Date = new Date(), windows: SendWindow[] = SEND_WINDOWS): WindowState {
  if (!templateKey) return { state: "none" };
  const mine = windows.filter((w) => w.templateKeys.includes(templateKey)).sort((a, b) => Date.parse(a.startISO) - Date.parse(b.startISO));
  if (!mine.length) return { state: "none" };
  const t = now.getTime();
  const open = mine.find((w) => t >= Date.parse(w.startISO) && t < Date.parse(w.endISO));
  if (open) return { state: "open", window: open };
  const next = mine.find((w) => t < Date.parse(w.startISO));
  if (next) return { state: "before", window: next };
  return { state: "after", window: mine[mine.length - 1] };
}

/** Template keys whose window is open right now (what the hourly sync should release). */
export function openWindowTemplateKeys(now: Date = new Date(), windows: SendWindow[] = SEND_WINDOWS): string[] {
  const t = now.getTime();
  return Array.from(new Set(windows.filter((w) => t >= Date.parse(w.startISO) && t < Date.parse(w.endISO)).flatMap((w) => w.templateKeys)));
}
