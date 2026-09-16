// ============================================================
// Regression test for the sidebar "Search anything" bug: any search term
// containing a comma broke /api/team/search with a PostgREST PGRST100
// parse error (commas are the .or() clause separator), silently swallowed
// into a false "no results" for the rep. Live-verified against the actual
// Supabase project: an unescaped "Roofing, LLC" filter returns HTTP 400;
// the same value wrapped via toOrFilterValue() returns HTTP 200.
//
// Run with: npx tsx --test tests/lib/postgrest-filter.test.ts
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { toOrFilterValue } from "../../lib/postgrestFilter";

test("wraps the value in double quotes", () => {
  assert.equal(toOrFilterValue("%roofing%"), '"%roofing%"');
});

test("a comma (the .or() clause separator) survives inside the quoted value", () => {
  const result = toOrFilterValue("%Roofing, LLC%");
  assert.equal(result, '"%Roofing, LLC%"');
  // The whole thing must stay ONE quoted token -- no unescaped comma
  // outside the quotes that PostgREST's parser would treat as a new clause.
  const insideQuotes = result.slice(1, -1);
  assert.equal(insideQuotes.includes(","), true);
});

test("literal double-quotes in the term are escaped so they don't terminate the value early", () => {
  const result = toOrFilterValue('%Bob\'s "Best" Roofing%');
  assert.equal(result, '"%Bob\'s \\"Best\\" Roofing%"');
});

test("literal backslashes are escaped", () => {
  const result = toOrFilterValue("%A\\B%");
  assert.equal(result, '"%A\\\\B%"');
});

test("parentheses (the .or() grouping character) pass through safely inside quotes", () => {
  const result = toOrFilterValue("%(555) 123-4567%");
  assert.equal(result, '"%(555) 123-4567%"');
});
