import { test } from "node:test";
import assert from "node:assert/strict";
import { sendWindowState, openWindowTemplateKeys, SEND_WINDOWS } from "../../lib/outbound/sendWindow";

const K = "sfb_roofing_missed_calls";
const at = (iso: string) => new Date(iso);

test("roofing window is Mon Oct 19 2026, 6–9 PM Eastern (22:00–01:00 UTC)", () => {
  const w = SEND_WINDOWS.find((x) => x.templateKeys.includes(K))!;
  assert.equal(new Date(w.startISO).toISOString(), "2026-10-19T22:00:00.000Z");
  assert.equal(new Date(w.endISO).toISOString(), "2026-10-20T01:00:00.000Z");
});

test("held before, open inside, released-by-hand after", () => {
  assert.equal(sendWindowState(K, at("2026-10-19T04:40:00Z")).state, "before"); // 12:40 AM ET
  assert.equal(sendWindowState(K, at("2026-10-19T21:59:00Z")).state, "before"); // 5:59 PM ET
  assert.equal(sendWindowState(K, at("2026-10-19T22:15:00Z")).state, "open");   // 6:15 PM ET tick
  assert.equal(sendWindowState(K, at("2026-10-20T00:15:00Z")).state, "open");   // 8:15 PM ET tick
  assert.equal(sendWindowState(K, at("2026-10-20T01:00:00Z")).state, "after");  // 9:00 PM ET
});

test("other templates and missing keys are never held", () => {
  for (const k of ["intro", "follow_up_1", "reply_thanks", "booking_confirmation", "custom", null]) assert.equal(sendWindowState(k, at("2026-10-19T12:00:00Z")).state, "none");
});

test("hourly sync releases only inside the window", () => {
  assert.deepEqual(openWindowTemplateKeys(at("2026-10-19T23:15:00Z")), [K]);
  assert.deepEqual(openWindowTemplateKeys(at("2026-10-19T21:15:00Z")), []);
  assert.deepEqual(openWindowTemplateKeys(at("2026-10-20T01:15:00Z")), []);
});
