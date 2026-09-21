import { test } from "node:test";
import assert from "node:assert/strict";
import { computePresenceScore, computeEvidenceConfidence } from "../../lib/intelligence/scoring";
import { resolveEntityMatch, statusFromMatches } from "../../lib/intelligence/entityResolution";
import { extractBusinessCandidates, normalizeDomain } from "../../lib/intelligence/providers";
import { deriveFindings, wasConditionRetested, shouldResolveFinding, conditionTuplesForFindingKey } from "../../lib/intelligence/findings";

// ---------- SCORE (item 77) ----------
test("score: 2 detected, 1 not_detected, 1 error, 1 not_tested -> denominator 3, score 67", () => {
  const obs = [{ status: "detected" }, { status: "detected" }, { status: "not_detected" }, { status: "error" }, { status: "not_tested" }];
  assert.equal(computePresenceScore(obs), 67);
});
test("score: all detected -> 100; none detected -> 0", () => {
  assert.equal(computePresenceScore([{ status: "detected" }, { status: "detected" }]), 100);
  assert.equal(computePresenceScore([{ status: "not_detected" }, { status: "not_detected" }]), 0);
});
test("score: zero valid observations -> null (never a fabricated 0) (item 78)", () => {
  assert.equal(computePresenceScore([{ status: "error" }, { status: "not_tested" }, { status: "inconclusive" }]), null);
  assert.equal(computePresenceScore([]), null);
});
test("score: provider errors do not lower the score (item 41)", () => {
  const clean = computePresenceScore([{ status: "detected" }, { status: "detected" }, { status: "not_detected" }]);
  const withErrors = computePresenceScore([{ status: "detected" }, { status: "detected" }, { status: "not_detected" }, { status: "error" }, { status: "error" }, { status: "error" }]);
  assert.equal(clean, withErrors);
});
test("score: deterministic -- same input, same output", () => {
  const obs = [{ status: "detected" }, { status: "not_detected" }, { status: "detected" }];
  assert.equal(computePresenceScore(obs), computePresenceScore([...obs].reverse()));
});

// ---------- EVIDENCE CONFIDENCE (items 38-39) ----------
test("evidence: zero valid -> insufficient", () => {
  assert.equal(computeEvidenceConfidence([{ status: "error", platform: "perplexity", tracked_query_id: "q1" }]).confidence, "insufficient");
});
test("evidence: 2 valid on 1 platform -> low, with counts", () => {
  const e = computeEvidenceConfidence([
    { status: "detected", platform: "perplexity", tracked_query_id: "q1" },
    { status: "not_detected", platform: "perplexity", tracked_query_id: "q2" },
  ]);
  assert.equal(e.confidence, "low");
  assert.equal(e.validCount, 2);
  assert.equal(e.platformsTested, 1);
  assert.equal(e.queriesTested, 2);
});
test("evidence: 20 valid across 3 platforms, low error share -> high", () => {
  const obs: any[] = [];
  for (let i = 0; i < 20; i++) obs.push({ status: i % 3 === 0 ? "not_detected" : "detected", platform: ["perplexity", "chatgpt", "claude"][i % 3], tracked_query_id: `q${i % 7}` });
  assert.equal(computeEvidenceConfidence(obs).confidence, "high");
});
test("evidence: heavy error share caps at low even with many valid", () => {
  const obs: any[] = [];
  for (let i = 0; i < 6; i++) obs.push({ status: "detected", platform: ["perplexity", "chatgpt"][i % 2], tracked_query_id: `q${i}` });
  for (let i = 0; i < 10; i++) obs.push({ status: "error", platform: "grok", tracked_query_id: `e${i}` });
  assert.equal(computeEvidenceConfidence(obs).confidence, "low");
});

// ---------- ENTITY RESOLUTION (item 33) ----------
const biz = { name: "ABC Roofing LLC", website: "https://www.abcroofing.com" };
test("entity: exact domain -> confirmed_match", () => {
  assert.equal(resolveEntityMatch(biz, { name: "abcroofing.com", domain: "abcroofing.com", sourceUrl: null, isTarget: false }), "confirmed_match");
});
test("entity: different domain -> not_match even with same name", () => {
  assert.equal(resolveEntityMatch(biz, { name: "ABC Roofing", domain: "abcroofingtexas.com", sourceUrl: null, isTarget: false }), "not_match");
});
test("entity: same normalized name, no domain -> probable_match (never confirmed)", () => {
  assert.equal(resolveEntityMatch({ name: "ABC Roofing LLC", website: null }, { name: "ABC Roofing", domain: null, sourceUrl: null, isTarget: false }), "probable_match");
});
test("entity: partial overlap, no domain -> ambiguous -> inconclusive status", () => {
  const m = resolveEntityMatch({ name: "ABC Roofing", website: null }, { name: "ABC Roofing & Solar Experts", domain: null, sourceUrl: null, isTarget: false });
  assert.equal(m, "ambiguous");
  assert.equal(statusFromMatches([m, "not_match"]), "inconclusive");
});
test("entity: no candidates -> not_detected; any confirmed -> detected", () => {
  assert.equal(statusFromMatches([]), "not_detected");
  assert.equal(statusFromMatches(["not_match", "confirmed_match"]), "detected");
});

// ---------- EXTRACTION (item 32) ----------
test("extraction: citations produce domain candidates; directories excluded; dedup", () => {
  const cands = extractBusinessCandidates("Top picks: ABC Roofing (abcroofing.com) and see yelp.com for reviews.", ["https://www.abcroofing.com/services", "https://www.yelp.com/biz/abc", "https://rivalroofing.com"]);
  const domains = cands.map((c) => c.domain).sort();
  assert.deepEqual(domains, ["abcroofing.com", "rivalroofing.com"]);
  assert.equal(cands.find((c) => c.domain === "abcroofing.com")?.sourceUrl, "https://www.abcroofing.com/services");
});
test("normalizeDomain strips www and handles bare hosts", () => {
  assert.equal(normalizeDomain("https://www.Example.com/x"), "example.com");
  assert.equal(normalizeDomain("example.com"), "example.com");
  assert.equal(normalizeDomain(null), null);
});

// ---------- FINDINGS + PARTIAL SCAN (items 42-44, 73) ----------
const yours = [
  { id: "o1", tracked_query_id: "q1", query_text: "best roofer near me", platform: "perplexity", status: "not_detected", competitor_id: null },
  { id: "o2", tracked_query_id: "q1", query_text: "best roofer near me", platform: "chatgpt", status: "detected", competitor_id: null },
];
const comps = [{ id: "o3", tracked_query_id: "q1", query_text: "best roofer near me", platform: "perplexity", status: "detected", competitor_id: "c1" }];
test("findings: derives not_detected, platform_gap, competitor_present_gap with stable keys", () => {
  const f = deriveFindings(yours as any, comps as any);
  const keys = f.map((x) => x.findingKey).sort();
  assert.deepEqual(keys, ["competitor_present_gap:c1:perplexity::q1", "not_detected:q1:perplexity", "platform_gap:q1"]);
});
test("finding key parsing recovers exact condition tuple", () => {
  assert.deepEqual(conditionTuplesForFindingKey("not_detected:q1:perplexity"), { queryKey: "q1", platform: "perplexity" });
  assert.deepEqual(conditionTuplesForFindingKey("competitor_present_gap:c1:perplexity::q1"), { queryKey: "q1", platform: "perplexity" });
  assert.deepEqual(conditionTuplesForFindingKey("platform_gap:q1"), { queryKey: "q1", platform: null });
});
test("partial scan: finding NOT retested stays open (NOT TESTED != RESOLVED)", () => {
  const retested = [{ queryKey: "q2", platform: "perplexity" }]; // scanned a different query only
  assert.equal(shouldResolveFinding("not_detected:q1:perplexity", new Set(), retested), "keep_open_not_retested");
});
test("partial scan: same query on a DIFFERENT platform does not resolve a platform-specific finding", () => {
  assert.equal(shouldResolveFinding("not_detected:q1:perplexity", new Set(), [{ queryKey: "q1", platform: "chatgpt" }]), "keep_open_not_retested");
});
test("full retest with condition cleared -> resolve", () => {
  assert.equal(shouldResolveFinding("not_detected:q1:perplexity", new Set(), [{ queryKey: "q1", platform: "perplexity" }]), "resolve");
});
test("retest with condition still present -> keep open (refresh, not duplicate)", () => {
  assert.equal(shouldResolveFinding("not_detected:q1:perplexity", new Set(["not_detected:q1:perplexity"]), [{ queryKey: "q1", platform: "perplexity" }]), "keep_open_still_present");
});
test("platform_gap needs the query retested on >=2 platforms to be judgeable", () => {
  assert.equal(wasConditionRetested("platform_gap:q1", [{ queryKey: "q1", platform: "perplexity" }]), false);
  assert.equal(wasConditionRetested("platform_gap:q1", [{ queryKey: "q1", platform: "perplexity" }, { queryKey: "q1", platform: "chatgpt" }]), true);
});
