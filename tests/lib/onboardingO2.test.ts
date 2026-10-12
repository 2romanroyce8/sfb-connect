import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultIcp, parseIcpInput, icpQueries } from "../../lib/onboarding/icp";
import { toCandidates } from "../../lib/onboarding/leads";
import { previewSequence, CADENCES, cadence } from "../../lib/onboarding/automations";

test("ICP: preset + own market → suggested ICP; nothing to suggest → null", () => {
  const d = defaultIcp({ primary_category: "roofing contractor", city: "Tampa", state: "FL" })!;
  assert.deepEqual(d.locations, ["Tampa, FL"]); assert.ok(d.industries.includes("property management company")); assert.equal(d.source, "preset");
  assert.equal(defaultIcp({ primary_category: "unknown thing", city: null, state: null }), null);
});

test("ICP input: at least one industry and one location; lists deduped and capped; size validated", () => {
  assert.deepEqual(parseIcpInput({ industries: "", locations: "Tampa, FL" }), { error: "Name at least one kind of business you want more of (e.g. property management company)." });
  assert.match((parseIcpInput({ industries: "HOA", locations: [] }) as { error: string }).error, /city or area/);
  const ok = parseIcpInput({ industries: "HOA, hoa, home builder", locations: ["Tampa, FL", "Orlando, FL"], size: "nope", notes: "x" });
  assert.ok("icp" in ok); if ("icp" in ok) { assert.deepEqual(ok.icp.industries, ["HOA", "hoa", "home builder"].filter((v, i, a) => a.indexOf(v) === i)); assert.equal(ok.icp.size, "any"); assert.equal(ok.icp.source, "user"); }
  const q = icpQueries({ industries: ["a", "b", "c", "d"], locations: ["X, FL", "Y, FL"], size: "any", notes: null, source: "user" });
  assert.equal(q.length, 6); assert.equal(q[0], "a in X, FL");
});

test("lead candidates: directories dropped, own domain and existing prospects excluded, deduped by domain, city/state from the query location", () => {
  const exclude = new Set(["mine.com", "already.com"]);
  const res = [
    { title: "Acme Property Management | Home", url: "https://www.acmepm.com/", text: "We manage 400 doors" },
    { title: "Acme PM again", url: "https://acmepm.com/about" },
    { title: "Yelp list", url: "https://www.yelp.com/search?x" },
    { title: "Mine", url: "https://mine.com" },
    { title: "Already", url: "https://already.com" },
    { title: "Bay HOA Services", url: "https://bayhoa.net/" },
  ];
  const c = toCandidates(res, "property management company in Tampa, FL", exclude, "Tampa, FL");
  assert.deepEqual(c.map((x) => x.domain), ["acmepm.com", "bayhoa.net"]);
  assert.equal(c[0].name, "Acme Property Management"); assert.equal(c[0].city, "Tampa"); assert.equal(c[0].state, "FL"); assert.equal(c[0].website, "https://acmepm.com");
});

test("sequence preview renders real templates with the business's facts; missing offer line refuses instead of guessing", () => {
  const p = previewSequence(cadence("steady").steps, { name: "Dana Lee", company: "Lee Roofing", category: "roofing", offerLine: "We replace storm-damaged roofs in 48 hours." }, { company: "Acme PM", city: "Tampa", category: "property management company" });
  assert.equal(p.length, 3); assert.equal(p[0].day, 0); assert.match(p[0].subject, /Lee Roofing/); assert.match(p[0].body, /Acme PM team|Acme PM/); assert.match(p[0].body, /storm-damaged/);
  assert.throws(() => previewSequence(cadence("quick").steps, { name: "Dana", company: "Lee Roofing", category: null, offerLine: null }, { company: "Acme", city: null, category: null }), /needs facts/);
  assert.equal(CADENCES.length, 3); assert.deepEqual(cadence("bogus").key, "steady");
});
