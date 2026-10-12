import { test } from "node:test";
import assert from "node:assert/strict";
import { TOURS, placeTooltip, nextPresentStep, progressLabel, isMobile, CARD_W, CARD_H, GAP } from "../../lib/tours/definitions";

test("tours are data: every step has a target, title and body; onboarding has 11 steps with routes; dashboard has 5", () => {
  assert.equal(TOURS.onboarding.steps.length, 11); assert.equal(TOURS.dashboard.steps.length, 5);
  for (const t of Object.values(TOURS)) for (const s of t.steps) { assert.match(s.target, /^\[data-tour=/); assert.ok(s.title.length > 3); assert.ok(s.body.length > 20 && s.body.length < 220, `${s.id} body is 1–2 sentences`); }
  TOURS.onboarding.steps.forEach((s, i) => { assert.equal(s.target, `[data-tour="onb-step-${i + 1}"]`); assert.match(s.route!, /^\/dashboard\/onboarding\//); });
  assert.equal(TOURS.onboarding.autoStart("/dashboard/onboarding/gmail"), true); assert.equal(TOURS.dashboard.autoStart("/dashboard"), true); assert.equal(TOURS.dashboard.autoStart("/dashboard/billing"), false);
});

test("tooltip placement: below when it fits, flips above near the bottom, side placements honoured, always clamped into the viewport", () => {
  const vp = { width: 1280, height: 800 };
  let p = placeTooltip({ top: 100, left: 500, width: 200, height: 40 }, vp); assert.equal(p.side, "bottom"); assert.equal(p.top, 100 + 40 + GAP); assert.equal(p.left, 500 + 100 - CARD_W / 2);
  p = placeTooltip({ top: 740, left: 500, width: 200, height: 40 }, vp); assert.equal(p.side, "top"); assert.equal(p.top, 740 - GAP - CARD_H);
  p = placeTooltip({ top: 300, left: 20, width: 180, height: 36 }, vp, "right"); assert.equal(p.side, "right"); assert.equal(p.left, 20 + 180 + GAP);
  p = placeTooltip({ top: 10, left: 1200, width: 60, height: 30 }, vp); assert.ok(p.left + CARD_W + GAP <= vp.width, "clamped horizontally"); assert.ok(p.top >= GAP);
  const small = { width: 360, height: 640 }; assert.equal(isMobile(small), true); assert.equal(isMobile(vp), false);
});

test("missing targets skip silently in both directions; progress label reads n of total", () => {
  const steps = TOURS.dashboard.steps; const present = (s: { id: string }) => s.id !== "credits" && s.id !== "reports";
  assert.equal(nextPresentStep(steps, 0, present), 0);
  assert.equal(nextPresentStep(steps, 1, present), 2, "credits missing → actions");
  assert.equal(nextPresentStep(steps, 4, present), -1, "reports missing and it's the last → tour ends");
  assert.equal(nextPresentStep(steps, 1, present, -1), 0, "back over a missing step");
  assert.equal(nextPresentStep(steps, 0, () => false), -1, "nothing present → no broken tour, just nothing");
  assert.equal(progressLabel(2, 11), "3 of 11");
});
