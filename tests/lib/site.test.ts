import { test } from "node:test";
import assert from "node:assert/strict";
import { callbackWindowOpen, callbackPromise, callbackHint, SUPPORT_EMAIL, CALLBACK_HOURS_LABEL } from "../../lib/site";
import { PRIVACY, TERMS, isPublishable, renderPublicText } from "../../lib/legal/documents";

// Eastern Daylight Time on 2026-10-13: UTC-4. 11:30 ET = 15:30Z; 21:45 ET = 01:45Z next day.
test("callback window: 11:30 AM–9:45 PM Eastern, inclusive start, exclusive end", () => {
  assert.equal(callbackWindowOpen(new Date("2026-10-13T15:29:00Z")), false, "11:29 ET closed");
  assert.equal(callbackWindowOpen(new Date("2026-10-13T15:30:00Z")), true, "11:30 ET open");
  assert.equal(callbackWindowOpen(new Date("2026-10-13T23:00:00Z")), true, "7:00 PM ET open");
  assert.equal(callbackWindowOpen(new Date("2026-10-14T01:44:00Z")), true, "9:44 PM ET open");
  assert.equal(callbackWindowOpen(new Date("2026-10-14T01:45:00Z")), false, "9:45 PM ET closed");
  assert.equal(callbackWindowOpen(new Date("2026-10-14T06:00:00Z")), false, "2:00 AM ET closed");
  // Winter (EST, UTC-5): 11:30 ET = 16:30Z
  assert.equal(callbackWindowOpen(new Date("2026-12-01T16:29:00Z")), false);
  assert.equal(callbackWindowOpen(new Date("2026-12-01T16:30:00Z")), true);
});

test("callback copy states what we do, names the hours, and never says guarantee or '5 minutes'", () => {
  for (const s of [callbackPromise(new Date("2026-10-13T15:30:00Z")), callbackPromise(new Date("2026-10-14T06:00:00Z")), callbackHint(new Date("2026-10-13T15:30:00Z")), callbackHint(new Date("2026-10-14T06:00:00Z"))]) {
    assert.ok(!/guarantee/i.test(s), s); assert.ok(!/5 min|five min/i.test(s), s); assert.ok(s.includes("Roman"), s);
  }
  assert.ok(callbackPromise(new Date("2026-10-14T06:00:00Z")).includes(CALLBACK_HOURS_LABEL));
  assert.ok(callbackHint(new Date("2026-10-13T15:30:00Z")).includes(CALLBACK_HOURS_LABEL));
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
