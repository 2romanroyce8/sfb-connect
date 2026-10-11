import { test } from "node:test";
import assert from "node:assert/strict";
import { canSend, dueSteps, proposeSlots, pickEmail, unsubscribeToken, toE164 } from "../../lib/outbound/gate";
import { renderTemplate, DEFAULT_SEQUENCE_STEPS, TEMPLATES } from "../../lib/outbound/templates";

const base = { id: "m1", direction: "out" as const, to_email: "info@acme.com", approved_by: "u1", approved_at: "2026-10-11T00:00:00Z" };

test("the gate: only approved + human-attributed + outbound + valid recipient + not suppressed may send", () => {
  assert.deepEqual(canSend({ ...base, status: "approved" }, false), { ok: true });
  assert.equal(canSend({ ...base, status: "pending_approval" }, false).ok, false, "pending never sends");
  assert.equal(canSend({ ...base, status: "draft" }, false).ok, false);
  assert.equal(canSend({ ...base, status: "sent" }, false).ok, false, "no double send");
  assert.equal(canSend({ ...base, status: "approved", approved_by: null }, false).ok, false, "approved without a human is not approved");
  assert.equal(canSend({ ...base, status: "approved", approved_at: null }, false).ok, false);
  assert.equal(canSend({ ...base, status: "approved", to_email: "not-an-email" }, false).ok, false);
  assert.equal(canSend({ ...base, status: "approved" }, true).ok, false, "suppressed address never gets mail");
  assert.equal(canSend({ ...base, status: "approved", direction: "in" }, false).ok, false);
});

test("sequence steps come due by day offset and are never repeated", () => {
  const start = new Date("2026-10-01T12:00:00Z");
  assert.deepEqual(dueSteps(DEFAULT_SEQUENCE_STEPS, start, [0], new Date("2026-10-02T12:00:00Z")), []);
  assert.deepEqual(dueSteps(DEFAULT_SEQUENCE_STEPS, start, [0], new Date("2026-10-04T12:00:00Z")), [1]);
  assert.deepEqual(dueSteps(DEFAULT_SEQUENCE_STEPS, start, [0, 1], new Date("2026-10-09T12:00:00Z")), [2]);
  assert.deepEqual(dueSteps(DEFAULT_SEQUENCE_STEPS, start, [0, 1, 2], new Date("2026-11-01T12:00:00Z")), []);
});

test("slots: weekdays, business hours, no overlap with busy blocks, requested count", () => {
  const from = new Date("2026-10-12T15:00:00Z"); // Monday 11:00 ET (offset -240)
  const busy = [{ start: "2026-10-13T14:00:00Z", end: "2026-10-13T15:00:00Z" }]; // Tue 10:00–11:00 ET
  const slots = proposeSlots(busy, { from, days: 7, minutes: 15, tzOffsetMinutes: -240, count: 3 });
  assert.equal(slots.length, 3);
  for (const s of slots) {
    const d = new Date(s.start); const local = new Date(d.getTime() - 240 * 60_000);
    assert.ok(local.getUTCDay() >= 1 && local.getUTCDay() <= 5, "weekday");
    assert.ok(local.getUTCHours() >= 9 && local.getUTCHours() <= 16, "business hours");
    assert.ok(!(Date.parse(s.start) < Date.parse(busy[0].end) && Date.parse(s.end) > Date.parse(busy[0].start)), "no clash");
  }
  assert.notEqual(slots[0].start, "2026-10-13T14:00:00.000Z");
});

test("email pick: on-domain role addresses first, junk filtered, never invented", () => {
  assert.deepEqual(pickEmail(["bob@gmail.com", "info@acme.com", "x@sentry.io"], "acme.com"), { email: "info@acme.com", source: "mailto" });
  assert.equal(pickEmail(["logo@2x.png"], "acme.com"), null);
  assert.equal(pickEmail([], "acme.com"), null);
  assert.equal(toE164("(405) 223-7699"), "+14052237699"); assert.equal(toE164("12345"), null);
});

test("unsubscribe tokens are per message and not forgeable", () => {
  const a = unsubscribeToken("m1", "b1", "s"); const b = unsubscribeToken("m2", "b1", "s");
  assert.equal(a.length, 40); assert.notEqual(a, b); assert.notEqual(a, unsubscribeToken("m1", "b1", "other"));
});

test("templates render from facts only and refuse when a required fact is missing", () => {
  const v = { company: "Hallmark Property Management", contact_name: "Dana Lee", city: "Oklahoma City", category: "property management company", sender_name: "Roman Royce", sender_company: "Limitless Roofing OKC", sender_category: "roofing", offer_line: "We replace roofs for property managers with a 48-hour quote.", slots: "Tue 10:00, Wed 2:00 (ET)" };
  const r = renderTemplate("intro", v);
  assert.equal(r.subject, "Limitless Roofing OKC × Hallmark Property Management");
  assert.match(r.body, /^Hi Dana,/); assert.match(r.body, /48-hour quote/); assert.match(r.body, /Tue 10:00, Wed 2:00 \(ET\)/);
  assert.ok(!/\{\{/.test(r.body), "no unresolved placeholders");
  assert.throws(() => renderTemplate("intro", { ...v, offer_line: null }), /needs facts we don't have: offer_line/);
  assert.throws(() => renderTemplate("booking_confirmation", { ...v, booking_time: null }), /booking_time/);
  const noName = renderTemplate("follow_up_1", { ...v, contact_name: null });
  assert.match(noName.body, /^Hi Hallmark Property Management team,/);
  for (const t of Object.values(TEMPLATES)) assert.ok(t.requires.includes("company") && t.requires.includes("sender_name"));
});

test("retry rule: a failed send keeps its human approval, so the gate passes again once status is reset to approved", () => {
  // The DB update in retryFailedSend only matches status='failed' with approved_by/approved_at set; the gate then re-checks.
  assert.deepEqual(canSend({ ...base, status: "approved" }, false), { ok: true });
  assert.equal(canSend({ ...base, status: "failed" }, false).ok, false, "a failed row is never sent directly — it must be reset to approved first");
});
