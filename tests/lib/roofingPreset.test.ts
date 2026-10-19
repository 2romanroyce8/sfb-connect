import { test } from "node:test";
import assert from "node:assert/strict";
import { renderTemplate, yearsFromCustom } from "../../lib/outbound/templates";
import { PUBLIC_LIBRARY, LIBRARY, presetByKey } from "../../lib/outbound/presets";

const base = { company: "Ja-Mar Roofing", city: "Austin", sender_name: "Roman Royce", sender_company: "SFB Connect" };

test("Rome's roofing intro renders word for word", () => {
  const r = renderTemplate("sfb_roofing_missed_calls", base);
  assert.equal(r.subject, "Ja-Mar Roofing + missed calls");
  assert.equal(r.body, [
    "Hi Ja-Mar Roofing team,",
    "",
    "Saw Ja-Mar Roofing's been serving Austin — solid reputation.",
    "",
    "Quick question: when your crews are on roofs, who picks up the calls your office misses?",
    "",
    "I'm Rome with SFB Connect. We set roofing companies up with an AI team that answers every missed call, qualifies the homeowner, and books the job straight to your calendar — plus automated review requests after every job.",
    "",
    "Worth 15 minutes next week? I'll show you exactly what it'd do for Ja-Mar Roofing.",
    "",
    "Best,",
    "Rome Royce",
    "Founder, SFB Connect",
    "sfbconnect.com",
  ].join("\n"));
});

test("'for X years' only when we know it", () => {
  assert.match(renderTemplate("sfb_roofing_missed_calls", { ...base, years_in_business: 22 }).body, /serving Austin for 22 years — solid reputation\./);
  assert.match(renderTemplate("sfb_roofing_missed_calls", { ...base, years_in_business: 1 }).body, /for 1 year —/);
});

test("refuses without a city rather than guessing", () => {
  assert.throws(() => renderTemplate("sfb_roofing_missed_calls", { ...base, city: null }), /city/);
});

test("years come only from a clear uploaded column", () => {
  const now = new Date("2026-10-19T12:00:00Z");
  assert.equal(yearsFromCustom({ "Years in business": "22" }, now), 22);
  assert.equal(yearsFromCustom({ years: "15+ yrs" }, now), 15);
  assert.equal(yearsFromCustom({ Founded: "1998" }, now), 28);
  assert.equal(yearsFromCustom({ years: "about two decades" }, now), null);
  assert.equal(yearsFromCustom({ notes: "22" }, now), null);
  assert.equal(yearsFromCustom(null, now), null);
});

test("team-only: approved, in the team library, hidden from customers", () => {
  const p = presetByKey("sfb_roofing_missed_calls")!;
  assert.equal(p.teamOnly, true); assert.equal(p.approvedAt, "2026-10-19");
  assert.ok(LIBRARY.some((x) => x.key === p.key));
  assert.ok(!PUBLIC_LIBRARY.some((x) => x.key === p.key));
});
