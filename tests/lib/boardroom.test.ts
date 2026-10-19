import { test } from "node:test";
import assert from "node:assert/strict";
import { planProblems, campaignDraftFromIdea, pickWinner, resultSummary, EMPTY_METRICS, type Idea } from "../../lib/boardroom/loop";

const plan = { what: "Missed-calls hook vs reviews hook", who: "FL roofers, 5–50 staff", success: "10 calls booked", duration_days: 7, channels: ["email", "calls"], audience_tag: null };
const idea: Idea = { id: "idea-1", title: "Q4 roofing: missed-calls angle", description: "x", target_metric: "book 10 calls", status: "ready", plan };

test("plan builder: incomplete plans can't be sent", () => {
  assert.deepEqual(planProblems(plan), []);
  assert.equal(planProblems({ ...plan, success: "" }).length, 1);
  assert.equal(planProblems(null).length, 5);
});

test("send to Campaigns: the draft carries the whole plan and links the idea", () => {
  const d = campaignDraftFromIdea(idea, new Date("2026-10-19T09:00:00Z"));
  assert.equal(d.idea_id, "idea-1"); assert.equal(d.status, "draft");
  assert.equal(d.hypothesis, plan.what); assert.equal(d.audience, plan.who); assert.equal(d.success_criteria, plan.success);
  assert.deepEqual(d.channels, ["email", "calls"]); assert.deepEqual(d.plan_snapshot, plan);
  assert.equal(d.start_date, "2026-10-20"); assert.equal(d.end_date, "2026-10-26");
  assert.equal(d.audience_tag, "campaign-q4-roofing-missed-calls-angle");
});

test("A/B winner: needs enough sends, then best reply rate", () => {
  const m = (sends: number, replies: number, booked = 0) => ({ ...EMPTY_METRICS, sends, replies, booked });
  assert.equal(pickWinner([{ id: "a", name: "A", m: m(10, 3) }, { id: "b", name: "B", m: m(30, 1) }]).id, null);
  assert.equal(pickWinner([{ id: "a", name: "A", m: m(40, 4) }, { id: "b", name: "B", m: m(40, 1) }]).id, "a");
  assert.equal(pickWinner([{ id: "a", name: "Script A", m: m(0, 0, 3) }, { id: "b", name: "Script B", m: m(0, 0, 5) }]).id, "b");
  assert.equal(pickWinner([{ id: "a", name: "A", m: m(0, 0, 2) }, { id: "b", name: "B", m: m(0, 0, 2) }]).id, null);
});

test("results summary for the idea card", () => {
  const s = resultSummary({ name: "Q4 test", start_date: "2026-10-20", end_date: "2026-10-26", success_criteria: "10 calls booked" }, { ...EMPTY_METRICS, sends: 100, opens: 40, replies: 8, booked: 11, won: 2, revenue: 2994 }, "hit", { name: "Missed calls", reason: "8% vs 3%" }, "Scale to TX");
  assert.match(s, /HIT the goal — goal: 10 calls booked/); assert.match(s, /replies 8 \(8%\)/); assert.match(s, /Winner: Missed calls/); assert.match(s, /\$2,994/); assert.match(s, /Notes: Scale to TX/);
});
