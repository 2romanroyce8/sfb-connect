import { saveConnection, getStoredSecret } from "./connections";

/**
 * Apple Calendar via CalDAV (iCloud). Apple has no OAuth for calendars; the
 * supported path is an app-specific password (appleid.apple.com → Sign-In and
 * Security → App-Specific Passwords). We verify it with a CalDAV PROPFIND for
 * the current-user-principal, store it encrypted, and discover the calendar
 * home so bookings/availability can be read and written later.
 */
const CALDAV = "https://caldav.icloud.com";
const basic = (user: string, pass: string) => `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;

async function propfind(url: string, auth: string, body: string, depth = "0", f: typeof fetch = fetch) {
  const r = await f(url, { method: "PROPFIND", headers: { Authorization: auth, Depth: depth, "Content-Type": "application/xml; charset=utf-8" }, body });
  const text = await r.text();
  return { status: r.status, text };
}
const href = (xml: string, tag: string) => { const m = new RegExp(`<[^>]*${tag}[^>]*>\\s*<[^>]*href[^>]*>([^<]+)<`, "i").exec(xml); return m ? m[1].trim() : null; };

export async function verifyAppleCalendar(appleId: string, appPassword: string, f: typeof fetch = fetch): Promise<{ principal: string; calendarHome: string | null }> {
  if (!/^[^@\s]+@[^@\s]+$/.test(appleId)) throw new Error("Enter the Apple ID email.");
  if (!/^[a-z]{4}-[a-z]{4}-[a-z]{4}-[a-z]{4}$/i.test(appPassword.trim())) throw new Error("That doesn't look like an app-specific password (format xxxx-xxxx-xxxx-xxxx). Create one at appleid.apple.com.");
  const auth = basic(appleId, appPassword.trim());
  const p = await propfind(`${CALDAV}/`, auth, `<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:current-user-principal/></d:prop></d:propfind>`, "0", f);
  if (p.status === 401 || p.status === 403) throw new Error("iCloud rejected the Apple ID or app-specific password.");
  if (p.status < 200 || p.status >= 300 && p.status !== 207) throw new Error(`iCloud CalDAV returned ${p.status}.`);
  const principal = href(p.text, "current-user-principal");
  if (!principal) throw new Error("iCloud did not return a calendar principal for this account.");
  const principalUrl = principal.startsWith("http") ? principal : `${CALDAV}${principal}`;
  const h = await propfind(principalUrl, auth, `<?xml version="1.0"?><d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><c:calendar-home-set/></d:prop></d:propfind>`, "0", f);
  const home = href(h.text, "calendar-home-set");
  return { principal: principalUrl, calendarHome: home ? (home.startsWith("http") ? home : `${CALDAV}${home}`) : null };
}

export async function connectAppleCalendar(ownerId: string, appleId: string, appPassword: string) {
  const info = await verifyAppleCalendar(appleId, appPassword);
  await saveConnection("apple_calendar", ownerId, { access_token: appPassword.trim() }, appleId, { principal: info.principal, calendarHome: info.calendarHome, appleId });
  return info;
}

/** Lists the user's calendars (display names + hrefs) — proves the stored credential still works. */
export async function listAppleCalendars(ownerId: string, f: typeof fetch = fetch): Promise<{ name: string; href: string }[]> {
  const { secret, metadata } = await getStoredSecret("apple_calendar", ownerId);
  const home = metadata.calendarHome as string | null; const appleId = metadata.appleId as string;
  if (!home) return [];
  const r = await propfind(home, basic(appleId, secret), `<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:displayname/><d:resourcetype/></d:prop></d:propfind>`, "1", f);
  const out: { name: string; href: string }[] = [];
  for (const m of r.text.matchAll(/<d:response>([\s\S]*?)<\/d:response>/gi)) {
    const block = m[1];
    if (!/calendar\b/i.test(block) || !/<d:displayname>([^<]*)</i.test(block)) continue;
    const name = /<d:displayname>([^<]*)</i.exec(block)![1]; const hr = /<d:href>([^<]*)</i.exec(block)?.[1];
    if (name && hr) out.push({ name, href: hr });
  }
  return out;
}
