import { test } from "node:test";
import assert from "node:assert/strict";
import { PIPELINE_STAGES, MANUAL_STAGES, stageLabel } from "../../lib/crm/stages";

test("every stage the app writes has a board column and a label", () => {
  const values = PIPELINE_STAGES.map((s) => s.value);
  for (const v of ["demo_requested", "contacted", "interested", "follow_up", "meeting_booked", "meeting_completed", "won", "lost"]) assert.ok(values.includes(v), v);
  // Same 13 stages as lib/team/analytics/company.ts PIPELINE_STAGES.
  assert.equal(values.length, 13);
  assert.equal(stageLabel("meeting_completed"), "Demo Done");
  assert.equal(stageLabel("weird_stage"), "weird stage");
});

test("reps can move a lead out of / into Demo Done; demo_requested is website-only", () => {
  assert.ok(MANUAL_STAGES.includes("meeting_completed"));
  assert.ok(!MANUAL_STAGES.includes("demo_requested"));
});
