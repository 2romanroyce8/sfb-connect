import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSlots, etOffsetMinutes, icsFor, vcard, calendarLinks, parseDemoCallInput, SLOT_MINUTES, fmtET } from "../../lib/demoCall/booking";

test("Eastern offset is DST-aware (EDT in October, EST in December)", () => {
  assert.equal(etOffsetMinutes(new Date("2026-10-12T15:00:00Z")), -240);
  assert.equal(etOffsetMinutes(new Date("2026-12-12T15:00:00Z")), -300);
  assert.match(fmtET("2026-10-14T18:00:00Z"), /Oct 14, 2:00 PM ET$/);
});

test("slots: follow the weekly schedule (Mon–Fri 8:00–8:45 & 11:30–18:45, Sat–Sun 8:00–15:00 ET), 30 min, fit inside a window, lead time + busy blocks honoured", () => {
  const from = new Date("2026-10-12T13:00:00Z"); // Mon 9:00 AM ET
  const busy = [{ start: "2026-10-13T16:00:00Z", end: "2026-10-13T17:00:00Z" }]; // Tue 12:00–13:00 ET
  const days = buildSlots(busy, from, 7);
  assert.ok(days.length >= 7, "weekends are bookable now");
  const etMin = (iso: string) => { const d = new Date(Date.parse(iso) + etOffsetMinutes(new Date(iso)) * 60_000); return { dow: d.getUTCDay(), min: d.getUTCHours() * 60 + d.getUTCMinutes() }; };
  for (const d of days) for (const s of d.slots) {
    const { dow, min } = etMin(s.start);
    if (dow === 0 || dow === 6) assert.ok(min >= 8 * 60 && min + 30 <= 15 * 60, `weekend slot ${s.start} outside 8:00–15:00`);
    else assert.ok((min >= 8 * 60 && min + 30 <= 8 * 60 + 45) || (min >= 11 * 60 + 30 && min + 30 <= 18 * 60 + 45), `weekday slot ${s.start} outside the windows`);
    assert.equal(Date.parse(s.end) - Date.parse(s.start), SLOT_MINUTES * 60_000);
    assert.ok(Date.parse(s.start) >= from.getTime() + 120 * 60_000, "lead time");
  }
  const mon = days.find((d) => d.date === "2026-10-12")!; assert.equal(mon.slots[0].start, "2026-10-12T15:30:00.000Z", "first Monday slot is 11:30 ET (8:00 is past, 9–11 blocked)");
  const tue = days.find((d) => d.date === "2026-10-13")!;
  assert.equal(tue.slots[0].start, "2026-10-13T12:00:00.000Z", "Tuesday opens with the 8:00 slot (8:30 would end at 9:00 > 8:45)");
  assert.equal(tue.slots[1].start, "2026-10-13T15:30:00.000Z", "nothing between 8:30 and 11:30 ET");
  assert.ok(!tue.slots.some((s) => s.start === "2026-10-13T16:00:00.000Z" || s.start === "2026-10-13T16:30:00.000Z"), "busy 12:00–13:00 ET removed");
  assert.equal(tue.slots[tue.slots.length - 1].start, "2026-10-13T22:00:00.000Z", "last weekday slot starts 6:00 PM ET (6:30 would end 7:00 > 6:45)");
  assert.match(tue.label, /^Tue, Oct 13$/);
  const sat = days.find((d) => d.date === "2026-10-17")!;
  assert.equal(sat.slots[0].start, "2026-10-17T12:00:00.000Z", "Saturday 8:00 ET"); assert.equal(sat.slots[sat.slots.length - 1].start, "2026-10-17T18:30:00.000Z", "Saturday last slot 2:30 PM ET");
  assert.equal(sat.slots.length, 14);
});

test("ics + vCard + add-to-calendar links are correct and escape safely", () => {
  const call = { id: "11111111-1111-1111-1111-111111111111", name: "Dana; Lee, Inc", start_at: "2026-10-14T18:00:00.000Z", end_at: "2026-10-14T18:30:00.000Z", meet_url: "https://meet.google.com/abc-defg-hij" };
  const ics = icsFor(call, "https://www.sfbconnect.com");
  assert.match(ics, /BEGIN:VCALENDAR\r\n/); assert.match(ics, /DTSTART:20261014T180000Z/); assert.match(ics, /DTEND:20261014T183000Z/); assert.match(ics, /UID:demo-11111111-1111-1111-1111-111111111111@sfbconnect\.com/);
  assert.match(ics, /Dana\\; Lee\\, Inc/, "commas and semicolons escaped"); assert.match(ics, /213-523-1641/);
  const v = vcard(); assert.match(v, /FN:SFB CONNECT/); assert.match(v, /TEL;TYPE=CELL,VOICE:\+12135231641/);
  const l = calendarLinks(call, "https://www.sfbconnect.com");
  assert.match(l.google, /dates=20261014T180000Z\/20261014T183000Z/); assert.match(l.ics, /\/api\/demo-call\/11111111-1111-1111-1111-111111111111\/ics$/); assert.equal(l.vcard, "https://www.sfbconnect.com/api/contact-card");
});

test("booking input: name, email, phone (10+ digits) and a real time are required; callNow is a strict boolean", () => {
  const ok = parseDemoCallInput({ name: "Roman Royce", email: "r@x.co", phone: "(405) 223-7699", start: "2026-10-14T18:00:00Z", callNow: true });
  assert.ok(!("error" in ok)); if (!("error" in ok)) { assert.equal(ok.callNow, true); assert.equal(ok.start, "2026-10-14T18:00:00.000Z"); }
  assert.deepEqual(parseDemoCallInput({ name: "Roman", email: "r@x.co", phone: "123", start: "2026-10-14T18:00:00Z" }), { error: "Enter the phone number we should call." });
  assert.deepEqual(parseDemoCallInput({ name: "Roman", email: "r@x.co", phone: "4052237699", start: "soon" }), { error: "Pick a time." });
  const notNow = parseDemoCallInput({ name: "Roman", email: "r@x.co", phone: "4052237699", start: "2026-10-14T18:00:00Z", callNow: "yes" }); if (!("error" in notNow)) assert.equal(notNow.callNow, false);
});
