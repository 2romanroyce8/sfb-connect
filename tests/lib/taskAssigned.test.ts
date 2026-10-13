import { test } from "node:test";
import assert from "node:assert/strict";
import { newlyAssigned } from "../../lib/notify/taskAssigned";
import { CONFIGURABLE_TRIGGERS, decideChannels, gatewayAddress } from "../../lib/notify/sms";

test("newlyAssigned: only people added this time; the assigner is never told about their own action; blanks and dupes dropped", () => {
  assert.deepEqual(newlyAssigned([], ["logan"], "roman"), ["logan"]);
  assert.deepEqual(newlyAssigned(["logan"], ["logan"], "roman"), [], "unchanged → nobody");
  assert.deepEqual(newlyAssigned(["logan"], ["braylen"], "roman"), ["braylen"], "reassignment → only the new person");
  assert.deepEqual(newlyAssigned(["logan"], ["logan", "braylen", "braylen", null], "roman"), ["braylen"]);
  assert.deepEqual(newlyAssigned([], ["roman"], "roman"), [], "assigning yourself is silent");
  assert.deepEqual(newlyAssigned([null], [null], "roman"), []);
});

test("task_assigned is a configurable trigger and T-Mobile numbers route to tmomail.net; unverified → text + email", () => {
  assert.ok(CONFIGURABLE_TRIGGERS.some((t) => t.key === "task_assigned"));
  assert.equal(gatewayAddress("303-875-8570", "tmobile"), "3038758570@tmomail.net");
  assert.equal(gatewayAddress("(225) 210-7284", "tmobile"), "2252107284@tmomail.net");
  const u = { id: "l", email: "l@x.com", notify_phone: "3038758570", notify_carrier: "tmobile", notify_prefs: {}, notify_sms_verified_at: null, notify_sms_last_bounce_at: null };
  const d = decideChannels(u, "task_assigned");
  assert.equal(d.gateway, "3038758570@tmomail.net"); assert.equal(d.email, true); assert.equal(d.emailReason, "unverified_sms");
  const v = decideChannels({ ...u, notify_sms_verified_at: "2026-10-12T00:00:00Z" }, "task_assigned");
  assert.equal(v.gateway, "3038758570@tmomail.net"); assert.equal(v.email, false, "verified → text only");
  const off = decideChannels({ ...u, notify_prefs: { task_assigned: false } }, "task_assigned");
  assert.equal(off.gateway, null); assert.equal(off.smsSkipReason, "pref_off");
});
