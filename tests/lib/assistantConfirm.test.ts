import { test } from "node:test";
import assert from "node:assert/strict";
import { signAction, verifyAction } from "../../lib/assistant/confirm";

const a = { intent: "move_stage", args: { leadId: "L1", stage: "contacted", from: "new" } };
const team = { role: "team" as const, userId: "u1" };
test("writes need a matching, unexpired, same-user token", () => {
  const t = signAction(a, team, 1000);
  assert.equal(verifyAction(t, a, team, 2000), true);
  assert.equal(verifyAction(t, { ...a, args: { ...a.args, stage: "lost" } }, team, 2000), false); // tampered action
  assert.equal(verifyAction(t, a, { role: "team", userId: "u2" }, 2000), false);                 // other user
  assert.equal(verifyAction(t, a, { role: "client", userId: "u1", businessId: "b" }, 2000), false); // other role
  assert.equal(verifyAction(t, a, team, 1000 + 11 * 60_000), false);                             // expired
  const c = signAction(a, { role: "client", userId: "u1", businessId: "A" }, 1000);
  assert.equal(verifyAction(c, a, { role: "client", userId: "u1", businessId: "B" }, 2000), false); // other business
});
