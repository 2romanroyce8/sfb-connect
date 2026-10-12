import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSlots, etOffsetMinutes, icsFor, vcard, calendarLinks, parseDemoCallInput, SLOT_MINUTES, fmtET } from "../../lib/demoCall/booking";

test("Eastern offset is DST-aware (EDT in October, EST in December)", () => {
  assert.equal(etOffsetMinutes(new Date("2026-10-12T15:00:00Z")), -240);
  assert.equal(etOffsetMinutes(new Date("2026-12-12T15:00:00Z")), -300);
  assert.match(fmtET("2026-10-14T18:00:00Z"), /Oct 14, 2:00 PM ET$/);
});

test("slots: weekdays only, 9:00–16:30 ET, 30 min, nothing inside the 2-hour lead, busy blocks removed, labeled in ET", () => {
  const from = new Date("2026-10-12T13:00:00Z"); // Mon 9:00 AM ET
  const busy = [{ start: "2026-10-13T14:00:00Z", end: "2026-10-13T15:00:00Z" }]; // Tue 10:00–11:00 ET
  const days = buildSlots(busy, from, 7);
  assert.ok(days.length >= 5);
  for (const d of days) {
    for (const s of d.slots) {
      const local = new Date(Date.parse(s.start) + etOffsetMinutes(new Date(s.start)) * 60_000);
      assert.ok(local.getUTCDay() >= 1 && local.getUTCDay() <= 5, "weekday"); assert.ok(local.getUTCHours() >= 9 && local.getUTCHours() <= 16, "business hours");
      assert.equal(Date.parse(s.end) - Date.parse(s.start), SLOT_MINUTES * 60_000);
      assert.ok(Date.parse(s.start) >= from.getTime() + 120 * 60_000, "lead time");
    }
  }
  const mon = days.find((d) => d.date === "2026-10-12")!; assert.equal(mon.slots[0].start, "2026-10-12T15:00:00.000Z", "first Monday slot is 11:00 ET (9:00 + 2h lead)");
  const tue = days.find((d) => d.date === "2026-10-13")!; assert.ok(!tue.slots.some((s) => s.start === "2026-10-13T14:00:00.000Z" || s.start === "2026-10-13T14:30:00.000Z"), "busy 10:00–11:00 ET removed");
  assert.ok(tue.slots.some((s) => s.start === "2026-10-13T15:00:00.000Z"), "11:00 ET still open");
  assert.match(tue.label, /^Tue, Oct 13$/);
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
