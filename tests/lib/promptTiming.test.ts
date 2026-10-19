import { test } from "node:test";
import assert from "node:assert/strict";
import { formatAge, queuedFor, waitedBeforeSend, POLL_MS } from "../../lib/crm/promptTiming";

test("age format", () => {
  assert.equal(formatAge(30_000), "under 1m");
  assert.equal(formatAge(14 * 60_000), "14m");
  assert.equal(formatAge((2 * 60 + 14) * 60_000), "2h 14m");
  assert.equal(formatAge((3 * 60 + 22) * 60_000 + 59_000), "3h 22m");
  assert.equal(formatAge((26 * 60 + 5) * 60_000), "1d 2h");
});

test("live while queued, frozen once sent", () => {
  const created = "2026-10-19T04:00:00Z";
  assert.equal(formatAge(queuedFor(created, Date.parse("2026-10-19T06:14:30Z"))), "2h 14m");
  assert.equal(formatAge(waitedBeforeSend(created, "2026-10-19T07:22:00Z")!), "3h 22m");
  assert.equal(waitedBeforeSend(created, null), null);
  assert.equal(queuedFor("2026-10-19T09:00:00Z", Date.parse("2026-10-19T08:00:00Z")), 0);
  assert.equal(POLL_MS, 60_000);
});
