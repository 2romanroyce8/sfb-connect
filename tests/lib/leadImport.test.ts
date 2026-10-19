import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsv, suggestLeadMapping, validateLeadMapping, buildLeadRows, findDuplicates, mergeRows, assigneeFor, tagsFor, splitTags, isPlaceholderEmail } from "../../lib/crm/leadImport";

const CSV = `name,website,city,phone,email,notes,state_group
Ja-Mar Roofing & Sheet Metal,jamarroofing.com,Austin,(512) 555-0100,info@jamar.com,Family owned,TX
Ja-Mar Roofing & Sheet Metal,,San Antonio,512-555-0100,,SA branch,TX
Sunshine Roofing,sunshineroof.com,Tampa,813.555.0199,hello@sunshine.com,,FL
No Phone Co,nophone.com,Miami,,x@y.com,,FL
Bad Phone LLC,,Orlando,123,,,FL
Phoenix Roofers,phxroof.com,Phoenix,+1 602 555 0123,bad-email,,GA-AZ
Atlanta Roof Pros,atlroof.com,Atlanta,4045550177,,,GA-AZ
`;

test("mapping: headers are guessed; name+phone are required; duplicates of a field refused", () => {
  const p = parseCsv(CSV); const m = suggestLeadMapping(p.headers);
  assert.equal(m.name, "business_name"); assert.equal(m.phone, "phone"); assert.equal(m.state_group, "group"); assert.equal(m.notes, "notes");
  assert.equal(validateLeadMapping(m), null);
  assert.match(validateLeadMapping({ a: "business_name" })!, /Phone/);
  assert.match(validateLeadMapping({ a: "business_name", b: "phone", c: "phone" })!, /Two columns/);
});

test("validation: missing name/phone, invalid phone and invalid email are reported with CSV row numbers; phones normalize to 10 digits", () => {
  const p = parseCsv(CSV); const { rows, issues } = buildLeadRows(p, suggestLeadMapping(p.headers));
  assert.deepEqual(issues.map((i) => [i.row, i.reason]), [[5, "missing_phone"], [6, "invalid_phone"], [7, "invalid_email"]]);
  assert.equal(rows.length, 4);
  assert.equal(rows[0].phone, "5125550100"); assert.equal(rows[1].phone, "5125550100"); assert.equal(rows[2].phone, "8135550199");
  assert.equal(rows[0].website, "jamarroofing.com"); assert.equal(rows[0].group, "TX");
});

test("dedupe: same phone OR same name (case-insensitive) groups rows; existing leads are matched too; merge keeps both cities and joins notes", () => {
  const p = parseCsv(CSV); const { rows } = buildLeadRows(p, suggestLeadMapping(p.headers));
  const existing = [{ id: "e1", business_name: "SUNSHINE ROOFING", phone_normalized: null }, { id: "e2", business_name: "Other Co", phone_normalized: "4045550177" }];
  const { groups, singles } = findDuplicates(rows, existing);
  assert.equal(singles.length, 0);
  const jamar = groups.find((g) => g.rows.length === 2)!; assert.ok(jamar.why.includes("phone") && jamar.why.includes("name")); assert.equal(jamar.existing.length, 0);
  const sun = groups.find((g) => g.rows[0].business_name === "Sunshine Roofing")!; assert.deepEqual(sun.existing.map((e) => e.id), ["e1"]); assert.deepEqual(sun.why, ["name"]);
  const atl = groups.find((g) => g.rows[0].business_name === "Atlanta Roof Pros")!; assert.deepEqual(atl.existing.map((e) => e.id), ["e2"]); assert.deepEqual(atl.why, ["phone"]);
  const merged = mergeRows(jamar.rows);
  assert.equal(merged.city, "Austin / San Antonio"); assert.equal(merged.notes, "Family owned | SA branch"); assert.equal(merged.website, "jamarroofing.com"); assert.equal(merged.email, "info@jamar.com");
});

test("assignment by column value is case-insensitive; unmatched → null; range tags hit the last N CSV rows; tags are unioned and lowercased", () => {
  const p = parseCsv(CSV); const { rows } = buildLeadRows(p, suggestLeadMapping(p.headers));
  const rule = { column: "group", map: { fl: "u-roman", TX: "u-braylen", "ga-az": "u-logan" } };
  assert.equal(assigneeFor(rows[0], rule), "u-braylen"); assert.equal(assigneeFor(rows[2], rule), "u-roman"); assert.equal(assigneeFor(rows[3], rule), "u-logan");
  assert.equal(assigneeFor({ ...rows[0], group: "NY" }, rule), null);
  const total = p.rows.length; // 7 data rows → last 2 are CSV rows 7 and 8
  assert.deepEqual(tagsFor(rows[3], ["Roofing-Pilot"], { lastN: 2, tags: ["priority-dossier"] }, total), ["roofing-pilot", "priority-dossier"]);
  assert.deepEqual(tagsFor(rows[0], ["roofing-pilot"], { lastN: 2, tags: ["priority-dossier"] }, total), ["roofing-pilot"]);
  assert.deepEqual(splitTags("A, b;c|a"), ["a", "b", "c"]);
});

test("placeholder emails (n/a, —, [email protected]) import as call-only leads with a blank email — never as errors", () => {
  for (const v of ["n/a", "N/A", "—", "-", "[email protected]", "none", ""]) assert.equal(isPlaceholderEmail(v) || v === "", true, v);
  assert.equal(isPlaceholderEmail("sales@jamarroofing.com"), false);
  const p = parseCsv("name,phone,email\nA Co,(305) 555-0100,n/a\nB Co,(305) 555-0101,—\nC Co,(305) 555-0102,[email protected]\nD Co,(305) 555-0103,not-an-email\n");
  const { rows, issues } = buildLeadRows(p, suggestLeadMapping(p.headers));
  assert.deepEqual(rows.map((r) => [r.business_name, r.email]), [["A Co", null], ["B Co", null], ["C Co", null]]);
  assert.deepEqual(issues.map((i) => [i.row, i.reason]), [[5, "invalid_email"]]);
});

