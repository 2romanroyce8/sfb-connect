import { test } from "node:test";
import assert from "node:assert/strict";
import { nextStageOf, planNextStage, FORWARD_PATH } from "../../lib/crm/nextStage";
import { PIPELINE_STAGES } from "../../lib/crm/stages";

test("forward path follows the board order and every step is a real stage", () => {
  const order = PIPELINE_STAGES.map((s) => s.value);
  assert.deepEqual([...FORWARD_PATH], order.slice(0, FORWARD_PATH.length));
  assert.deepEqual(nextStageOf("new"), { next: "researching" });
  assert.deepEqual(nextStageOf("contacted"), { next: "interested" });
});
test("proposal never auto-moves to won; won/lost/nurture have no next", () => {
  assert.ok("blocked" in nextStageOf("proposal")); assert.ok("blocked" in nextStageOf("won")); assert.ok("blocked" in nextStageOf("lost")); assert.ok("blocked" in nextStageOf("nurture"));
});
test("planNextStage groups by target and reports blocked leads", () => {
  const p = planNextStage([{ id: "a", stage: "new" }, { id: "b", stage: "new" }, { id: "c", stage: "contacted" }, { id: "d", stage: "proposal" }]);
  assert.deepEqual(p.moves, { researching: ["a", "b"], interested: ["c"] }); assert.equal(p.blocked.length, 1); assert.equal(p.blocked[0].id, "d");
});
