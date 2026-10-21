import { test } from "node:test";
import assert from "node:assert/strict";
import { isFreemailDomain, reminderDue, retryEligible } from "../../lib/outbound/gate";
import { toCandidates } from "../../lib/onboarding/leads";
import { COALESCE_MINUTES, CONFIGURABLE_TRIGGERS } from "../../lib/notify/sms";

const now = new Date("2026-10-13T12:00:00Z");

test("G2: domains the customer removed earlier are excluded from the next search", () => {
  const exclude = new Set<string>(["removedlast.time"]);
  const out = toCandidates([{ title: "Removed Last Time", url: "https://www.removedlast.time/" }, { title: "Fresh Co", url: "https://fresh.co/" }], "law firm in Miami, FL", exclude, "Miami, FL");
  assert.deepEqual(out.map((c) => c.domain), ["fresh.co"]);
});

test("G6: a send is auto-retried only if human-approved, failed ≥ 1 h ago and younger than 14 days", () => {
  const base = { status: "failed", approved_by: "u1", approved_at: "2026-10-13T09:00:00Z", updated_at: "2026-10-13T10:30:00Z", created_at: "2026-10-13T08:00:00Z" };
  assert.equal(retryEligible(base, now), true);
  assert.equal(retryEligible({ ...base, updated_at: "2026-10-13T11:30:00Z" }, now), false, "failed 30 min ago — too soon");
  assert.equal(retryEligible({ ...base, approved_by: null }, now), false, "never approved — never auto-sent");
  assert.equal(retryEligible({ ...base, created_at: "2026-09-20T08:00:00Z" }, now), false, "older than 14 days — left to a human");
  assert.equal(retryEligible({ ...base, status: "approved" }, now), false);
});

test("G7: free-mail domains never count as 'same company' for reply matching", () => {
  assert.equal(isFreemailDomain("gmail.com"), true); assert.equal(isFreemailDomain("www.outlook.com"), true); assert.equal(isFreemailDomain("acmepm.com"), false); assert.equal(isFreemailDomain(null), false);
});

test("G10: reminders are due at 24 h, not before", () => {
  assert.equal(reminderDue("2026-10-12T11:59:00Z", now), true);
  assert.equal(reminderDue("2026-10-12T12:01:00Z", now), false);
  assert.equal(reminderDue(null, now), false);
});

test("G9/G12: system_health is a real, configurable trigger coalesced to one text per hour", () => {
  assert.ok(CONFIGURABLE_TRIGGERS.some((t) => t.key === "system_health"));
  assert.equal(COALESCE_MINUTES.system_health, 60);
});
