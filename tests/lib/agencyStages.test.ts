import { test } from "node:test";
import assert from "node:assert/strict";
import { nextStageKey, planNext, type Stage } from "../../lib/agency/stages";
const S = (k: string, p: number, w = false, l = false): Stage => ({ key: k, label: k, position: p, is_won: w, is_lost: l });
const stages = [S("new", 1), S("contacted", 2), S("demo", 3), S("won", 4, true), S("lost", 5, false, true)];
test("next stage follows position, never enters Lost, and Won/Lost are terminal", () => {
  assert.deepEqual(nextStageKey(stages, "new"), { next: "contacted" }); assert.deepEqual(nextStageKey(stages, "demo"), { next: "won" });
  assert.ok("blocked" in nextStageKey(stages, "won")); assert.ok("blocked" in nextStageKey(stages, "lost")); assert.ok("blocked" in nextStageKey(stages, "zzz"));
});
test("custom stage order is respected and groups per target", () => {
  const custom = [S("a", 10), S("b", 20), S("c", 30), S("lost", 99, false, true)];
  assert.deepEqual(nextStageKey(custom, "a"), { next: "b" }); assert.ok("blocked" in nextStageKey(custom, "c"));
  const p = planNext(stages, [{ id: "1", stage: "new" }, { id: "2", stage: "new" }, { id: "3", stage: "contacted" }, { id: "4", stage: "won" }]);
  assert.deepEqual(p.moves, { contacted: ["1", "2"], demo: ["3"] }); assert.equal(p.blocked.length, 1);
});
