import { test } from "node:test";
import assert from "node:assert/strict";
import { callbackWindowOpen, callbackPromise, callbackHint, SUPPORT_EMAIL, HOURS_LABEL } from "../../lib/site";
import { PRIVACY, TERMS, isPublishable, renderPublicText } from "../../lib/legal/documents";

// EDT (UTC-4) in October. Tue 2026-10-13 is a weekday; Sat 2026-10-17 a weekend day.
test("callback window = booking schedule: Mon–Fri 8:00–8:45 & 11:30–18:45, Sat–Sun 8:00–15:00 ET", () => {
  assert.equal(callbackWindowOpen(new Date("2026-10-13T11:59:00Z")), false, "7:59 AM closed");
  assert.equal(callbackWindowOpen(new Date("2026-10-13T12:00:00Z")), true, "8:00 AM open");
  assert.equal(callbackWindowOpen(new Date("2026-10-13T12:45:00Z")), false, "8:45 AM closed");
  assert.equal(callbackWindowOpen(new Date("2026-10-13T14:00:00Z")), false, "10:00 AM blocked");
  assert.equal(callbackWindowOpen(new Date("2026-10-13T15:30:00Z")), true, "11:30 AM open");
  assert.equal(callbackWindowOpen(new Date("2026-10-13T22:44:00Z")), true, "6:44 PM open");
  assert.equal(callbackWindowOpen(new Date("2026-10-13T22:45:00Z")), false, "6:45 PM closed");
  assert.equal(callbackWindowOpen(new Date("2026-10-17T18:59:00Z")), true, "Sat 2:59 PM open");
  assert.equal(callbackWindowOpen(new Date("2026-10-17T19:00:00Z")), false, "Sat 3:00 PM closed");
  assert.equal(callbackWindowOpen(new Date("2026-10-18T13:00:00Z")), true, "Sun 9:00 AM open (weekend has no 9–11 block)");
  // Winter (EST, UTC-5): Tue 2026-12-01, 11:30 ET = 16:30Z
  assert.equal(callbackWindowOpen(new Date("2026-12-01T16:29:00Z")), false);
  assert.equal(callbackWindowOpen(new Date("2026-12-01T16:30:00Z")), true);
});

test("callback copy states what we do, names the hours, and never says guarantee or '5 minutes'", () => {
  for (const s of [callbackPromise(new Date("2026-10-13T15:30:00Z")), callbackPromise(new Date("2026-10-13T14:00:00Z")), callbackHint(new Date("2026-10-13T15:30:00Z")), callbackHint(new Date("2026-10-13T14:00:00Z"))]) {
    assert.ok(!/guarantee/i.test(s), s); assert.ok(!/5 min|five min/i.test(s), s); assert.ok(s.includes("Roman"), s);
  }
  assert.ok(callbackPromise(new Date("2026-10-13T14:00:00Z")).includes(HOURS_LABEL));
  assert.ok(callbackHint(new Date("2026-10-13T15:30:00Z")).includes(HOURS_LABEL));
  assert.ok(callbackPromise(new Date("2026-10-13T15:30:00Z")).includes("within 15–30 minutes"), "inside the window: Roman calls back within 15–30 minutes (Roman, 2026-10-12)");
});

test("legal: every open item resolved from Roman's 2026-10-12 answers; both documents publishable; one support address", () => {
  assert.equal(isPublishable(PRIVACY), true); assert.equal(isPublishable(TERMS), true);
  for (const doc of [PRIVACY, TERMS]) for (const item of doc.openItems) assert.ok(item.resolution && item.resolution.trim(), `${doc.slug}.${item.id} blank`);
  const contact = renderPublicText("{{entity}} / {{address}} / {{contact_email}}", TERMS);
  assert.ok(contact.includes("Six Figure Blueprints LLC") && contact.includes("1200 Brickell Ave, Miami, FL") && contact.includes(SUPPORT_EMAIL), contact);
  assert.ok(renderPublicText("{{governing_law}}", TERMS).includes("Florida"));
  for (const id of ["support_email", "privacy_email", "contact_email"]) assert.equal(PRIVACY.openItems.find((i) => i.id === id)!.resolution, SUPPORT_EMAIL);
  assert.equal(SUPPORT_EMAIL, "sfbconnectsupport@gmail.com");
});
