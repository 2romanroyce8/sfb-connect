import { test } from "node:test";
import assert from "node:assert/strict";
import { atlasBrief, fmtEtShort, ATLAS_CALL_TO_ACTION } from "../../lib/crm/notifyAtlas";
test("brief: ET time, counts, sent names, call to action — all in the first 400 chars", () => {
  const at = new Date("2026-10-19T19:05:00Z");
  const b = atlasBrief(at, [{ name: "Q card", send_order: 1 }], [{ name: "Blitz #1 — bulk load", send_order: 1, sent_at: "2026-10-19T18:00:00Z" }, { name: "Tags fix", send_order: 2, sent_at: null }], "Roman Royce");
  const head = b.slice(0, 400);
  assert.match(head, /Pressed: Oct 19, 2026, 3:05:00 PM ET by Roman Royce/);
  assert.match(head, /Queue: 1 · Sent Prompts: 2/);
  assert.match(head, /Sent prompts to verify: Blitz #1 — bulk load; Tags fix/);
  assert.ok(head.includes(ATLAS_CALL_TO_ACTION));
  assert.equal(fmtEtShort(at), "3:05 PM");
});
