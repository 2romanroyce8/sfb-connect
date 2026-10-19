import { test } from "node:test";
import assert from "node:assert/strict";
import { ruleDueAt, ruleReason, isRuleOutcome, demoIsNoClose, hasUpcomingOpen, FOLLOWUP_RULE_DAYS } from "../../lib/crm/followupRules";

const T = new Date("2026-10-19T14:00:00Z");
const days = (d: Date | null) => (d!.getTime() - T.getTime()) / 864e5;

test("no answer / voicemail → +2 days; no close outcomes → +3 days", () => {
  assert.equal(days(ruleDueAt("no_answer", T)), 2);
  assert.equal(days(ruleDueAt("voicemail", T)), 2);
  assert.equal(days(ruleDueAt("interested", T)), 3);
  assert.equal(days(ruleDueAt("call_back_later", T)), 3);
  assert.equal(days(ruleDueAt("demo_no_close", T)), 3);
});

test("closes and dead ends get no automatic follow-up", () => {
  for (const o of ["booked_meeting", "sale_closed", "not_interested", "wrong_number", "bad_lead", "hung_up", "other"]) { assert.equal(ruleDueAt(o, T), null); assert.equal(isRuleOutcome(o), false); }
});

test("demo is a no-close unless the lead is already won", () => {
  assert.equal(demoIsNoClose("meeting_booked"), true);
  assert.equal(demoIsNoClose(null), true);
  assert.equal(demoIsNoClose("won"), false);
});

test("skip when an open follow-up is already scheduled ahead", () => {
  assert.equal(hasUpcomingOpen([{ status: "open", due_at: "2026-10-20T00:00:00Z" }], T), true);
  assert.equal(hasUpcomingOpen([{ status: "open", due_at: "2026-10-18T00:00:00Z" }], T), false);
  assert.equal(hasUpcomingOpen([{ status: "completed", due_at: "2026-10-25T00:00:00Z" }], T), false);
});

test("reason text names the rule", () => {
  assert.equal(ruleReason("no_answer"), "Auto follow-up: no answer (+2 days)");
  assert.equal(ruleReason("demo_no_close"), "Auto follow-up: demo completed without close (+3 days)");
  assert.equal(FOLLOWUP_RULE_DAYS.interested, 3);
});
