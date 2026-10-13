import { test } from "node:test";
import assert from "node:assert/strict";
import { retryBlocker, RETRY_MAX_ATTEMPTS, type FailedDelivery } from "../../lib/notify/retry";

const now = Date.parse("2026-10-13T02:00:00Z");
const base: FailedDelivery = { id: "a", user_id: "u", trigger: "lead_new", channel: "sms", to_address: "3035551212@tmomail.net", body: "(1/1) New lead", part: 1, parts: 1, status: "failed", reason: "send_failed:rate limited", attempts: 1, retried_at: null, created_at: new Date(now - 30 * 60_000).toISOString(), detail: null };

test("G5: a failed gateway SMS older than 10 min, under 24 h, under 3 attempts, unclaimed → retried", () => {
  assert.equal(retryBlocker(base, now), null);
});

test("G5: the blockers — too soon, too old, exhausted, already claimed, wrong status/channel/reason, no address", () => {
  assert.equal(retryBlocker({ ...base, created_at: new Date(now - 5 * 60_000).toISOString() }, now), "too_soon");
  assert.equal(retryBlocker({ ...base, created_at: new Date(now - 25 * 3600_000).toISOString() }, now), "too_old");
  assert.equal(retryBlocker({ ...base, attempts: RETRY_MAX_ATTEMPTS }, now), "exhausted");
  assert.equal(retryBlocker({ ...base, retried_at: new Date(now).toISOString() }, now), "already_retried");
  assert.equal(retryBlocker({ ...base, status: "sent" }, now), "not_failed");
  assert.equal(retryBlocker({ ...base, channel: "in_app" }, now), "channel");
  assert.equal(retryBlocker({ ...base, reason: "no_phone" }, now), "not_a_send_failure", "skips/fallbacks are decisions, not failures — never retried");
  assert.equal(retryBlocker({ ...base, to_address: null }, now), "no_address");
});

test("G5: an email retry needs the stored payload; rows logged before the payload was kept are left alone", () => {
  const email = { ...base, channel: "email", to_address: "owner@example.com", body: "New lead: Acme" };
  assert.equal(retryBlocker(email, now), "no_payload");
  assert.equal(retryBlocker({ ...email, detail: { email: { subject: "New lead: Acme", html: "<p>hi</p>" } } }, now), null);
  assert.equal(retryBlocker({ ...email, detail: { email: { subject: "x", text: "plain" } } }, now), null);
});
