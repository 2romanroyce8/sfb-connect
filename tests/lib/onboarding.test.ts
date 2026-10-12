import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveOnboarding, parseProfileInput, extractBrandColors, STEPS, type OnboardingFacts } from "../../lib/onboarding/flow";

const none: OnboardingFacts = { gmailConnected: false, calendarConnected: false, hasLogo: false, hasIcp: false, prospectCount: 0, activeSequence: false, dfyChoice: null, campaignLaunched: false, confirmedSteps: {}, dismissedAt: null, completedAt: null };

test("fresh customer: step 1 is current, 4–11 locked behind the two hard gates, dashboard pushes into the flow", () => {
  const s = deriveOnboarding(none);
  assert.equal(STEPS.length, 11);
  assert.equal(s.current, 1); assert.equal(s.gatesPassed, false); assert.equal(s.showFlow, true); assert.equal(s.percent, 0);
  assert.ok(s.steps.filter((x) => x.locked).map((x) => x.no).join() === "4,5,6,7,8,9,10,11");
  assert.equal(s.steps[1].locked, false, "Gmail itself is never locked");
});

test("gates: Gmail + Calendar connected unlocks the rest; current moves to the first unfinished step; resume lands there", () => {
  const s = deriveOnboarding({ ...none, confirmedSteps: { "1": "t" }, gmailConnected: true, calendarConnected: true });
  assert.equal(s.gatesPassed, true); assert.equal(s.showFlow, false, "once the gates pass the dashboard stops redirecting");
  assert.equal(s.current, 4); assert.equal(s.steps.every((x) => !x.locked), true);
  const later = deriveOnboarding({ ...none, confirmedSteps: { "1": "t", "4": "t", "5": "t" }, gmailConnected: true, calendarConnected: true, hasIcp: false });
  assert.equal(later.current, 6, "mid-flow resume: step 6 with 1–5 done");
});

test("derived steps come from real state: logo, ICP, reviewed prospects, active sequence, DFY choice, launched campaign", () => {
  const s = deriveOnboarding({ ...none, gmailConnected: true, calendarConnected: true, hasLogo: true, hasIcp: true, prospectCount: 12, confirmedSteps: { "1": "t", "5": "t", "7": "t" }, activeSequence: true, dfyChoice: "self_serve", campaignLaunched: true });
  assert.deepEqual(s.steps.filter((x) => x.done).map((x) => x.no), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(s.current, 11); assert.equal(s.percent, 91);
  const unreviewed = deriveOnboarding({ ...none, gmailConnected: true, calendarConnected: true, prospectCount: 12 });
  assert.equal(unreviewed.steps[6].done, false, "a lead list counts only once the user reviewed it");
});

test("gmail connected alone does not pass the gates; dismissal after gates keeps the checklist but stops the redirect", () => {
  const half = deriveOnboarding({ ...none, confirmedSteps: { "1": "t" }, gmailConnected: true });
  assert.equal(half.gatesPassed, false); assert.equal(half.current, 3); assert.equal(half.showFlow, true);
  const dismissed = deriveOnboarding({ ...none, gmailConnected: true, calendarConnected: true, dismissedAt: "t" });
  assert.equal(dismissed.showFlow, false); assert.ok(dismissed.remaining.length > 0);
});

test("profile input: name required, website must be a URL, state two letters, lists capped", () => {
  assert.deepEqual(parseProfileInput({ businessName: "X" }), { error: "Business name is required." });
  assert.deepEqual(parseProfileInput({ businessName: "Acme Roofing", website: "acme" }), { error: "Website should be a full URL (https://…)." });
  const ok = parseProfileInput({ businessName: "Acme Roofing", website: "https://acme.com", state: "tx", nicheTags: ["roofing", "", "storm"], services: Array(20).fill("s") });
  assert.ok("patch" in ok); if ("patch" in ok) { assert.equal(ok.patch.state, "TX"); assert.deepEqual(ok.patch.niche_tags, ["roofing", "storm"]); assert.equal((ok.patch.services as string[]).length, 12); }
});

test("brand colors: theme-color first, greys/near-white/near-black ignored, most-used first, max 4", () => {
  const html = `<meta name="theme-color" content="#C8FF3D"><style>.a{color:#111}.b{background:#0a84ff}.c{color:#0A84FF}.d{color:#fff}.e{color:#ff453a}.f{color:#888}</style>`;
  assert.deepEqual(extractBrandColors(html), ["#c8ff3d", "#0a84ff", "#ff453a"]);
});
