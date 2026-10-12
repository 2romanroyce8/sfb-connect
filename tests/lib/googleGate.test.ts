import { test } from "node:test";
import assert from "node:assert/strict";
import { canStartGoogleOAuth, normalizeGoogleEmail, alertsDue, alertMessage, clearancesBlocked, shouldCreateVerificationTask, counterLabel, TEST_USER_CAP } from "../../lib/google/gate";

test("gate: only cleared/connected customers may start Google OAuth; team members always may", () => {
  assert.equal(canStartGoogleOAuth("not_started", false), false);
  assert.equal(canStartGoogleOAuth("email_submitted", false), false);
  assert.equal(canStartGoogleOAuth(null, false), false);
  assert.equal(canStartGoogleOAuth("cleared", false), true);
  assert.equal(canStartGoogleOAuth("connected", false), true);
  assert.equal(canStartGoogleOAuth(null, true), true, "owner connection unaffected");
});

test("email normalization lowercases and rejects junk", () => {
  assert.equal(normalizeGoogleEmail("  Dana.Lee@Gmail.com "), "dana.lee@gmail.com");
  assert.equal(normalizeGoogleEmail("nope"), null); assert.equal(normalizeGoogleEmail(42), null);
});

test("thresholds fire once each at 70/85/95; 95 blocks new clearances; manual block honoured", () => {
  assert.deepEqual(alertsDue(69, []), []);
  assert.deepEqual(alertsDue(70, []), [70]);
  assert.deepEqual(alertsDue(86, [70]), [85]);
  assert.deepEqual(alertsDue(96, []), [70, 85, 95], "a jump fires every threshold passed");
  assert.deepEqual(alertsDue(96, [70, 85, 95]), []);
  assert.equal(alertMessage(70, 70).priority, "high"); assert.match(alertMessage(70, 70).title, /verification should be underway/);
  assert.match(alertMessage(85, 85).title, /URGENT/); assert.match(alertMessage(95, 95).title, /BLOCKED/);
  assert.equal(clearancesBlocked(94, false), false); assert.equal(clearancesBlocked(95, false), true); assert.equal(clearancesBlocked(3, true), true);
  assert.equal(counterLabel(12), `Google test users: 12 / ${TEST_USER_CAP}`);
});

test("verification task auto-creates exactly once at 20", () => {
  assert.equal(shouldCreateVerificationTask(19, false), false);
  assert.equal(shouldCreateVerificationTask(20, false), true);
  assert.equal(shouldCreateVerificationTask(45, true), false);
});
