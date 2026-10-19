import { test } from "node:test";
import assert from "node:assert/strict";
import { toggleId, selectAllVisible, actionable, allVisibleSelected, chunk, plural } from "../../lib/ui/selection";

test("toggle", () => { const s = toggleId(new Set(), "a"); assert.ok(s.has("a")); assert.ok(!toggleId(s, "a").has("a")); });
test("select all selects only what's visible; again clears visible", () => {
  const s = selectAllVisible(new Set(["z"]), ["a", "b"]); assert.deepEqual([...s].sort(), ["a", "b", "z"]);
  assert.ok(allVisibleSelected(s, ["a", "b"]));
  assert.deepEqual([...selectAllVisible(s, ["a", "b"])], ["z"]);
});
test("selection survives filtering, but actions only hit visible ∩ selected", () => {
  const s = new Set(["a", "b", "c"]);
  assert.deepEqual(actionable(s, ["b", "d"]), ["b"]);       // filter hides a, c
  assert.deepEqual(actionable(s, ["c", "b", "a"]), ["c", "b", "a"]); // re-sorted, still selected
});
test("batches + plurals", () => { assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]); assert.equal(plural(14, "email"), "14 emails"); assert.equal(plural(1, "email"), "1 email"); });
