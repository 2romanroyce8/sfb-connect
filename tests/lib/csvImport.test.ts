import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsv, suggestMapping, validateMapping, buildRows } from "../../lib/outbound/csvImport";

const MESSY = `﻿"Full Name",E-Mail Address,"Company Name",Phone Number,Web Site,Notes
"Smith, Jane",JANE@Example.com,Acme Property Mgmt,(813) 555-0100,www.acmepm.com,"Met at expo, wants ""quote"""
Bob Jones,bob@example.com,,813-555-0101,,
Carol,not-an-email,Carol's Cafe,,,
,dave@example.com,,,,
Jane Again,jane@example.com,Acme Property Mgmt,,,duplicate row
`;

test("parseCsv: BOM, quoted commas, doubled quotes, ragged rows", () => {
  const p = parseCsv(MESSY);
  assert.deepEqual(p.headers, ["Full Name", "E-Mail Address", "Company Name", "Phone Number", "Web Site", "Notes"]);
  assert.equal(p.rows.length, 5);
  assert.equal(p.rows[0][0], "Smith, Jane"); assert.equal(p.rows[0][5], 'Met at expo, wants "quote"');
  assert.equal(p.rows[2].length, 6, "ragged rows are padded to the header width");
  assert.equal(parseCsv("a;b\n1;2").headers.join("|"), "a|b", "semicolon delimiter auto-detected");
  assert.equal(parseCsv("").headers.length, 0);
});

test("suggestMapping: messy headers land on the right fields; unknowns become custom fields", () => {
  const m = suggestMapping(parseCsv(MESSY).headers);
  assert.deepEqual(m, { "Full Name": "name", "E-Mail Address": "email", "Company Name": "company", "Phone Number": "phone", "Web Site": "website", Notes: "custom" });
  assert.deepEqual(suggestMapping(["first_name", "LAST NAME", "email", "Org", "Account Owner"]), { first_name: "first_name", "LAST NAME": "last_name", email: "email", Org: "company", "Account Owner": "custom" });
});

test("validateMapping: needs an email column and a name/company column; no double-mapping", () => {
  assert.match(validateMapping({ a: "name" }) ?? "", /Email/);
  assert.match(validateMapping({ a: "email" }) ?? "", /name or company/);
  assert.match(validateMapping({ a: "email", b: "email", c: "name" }) ?? "", /Two columns/);
  assert.equal(validateMapping({ a: "email", b: "company", c: "custom", d: "ignore" }), null);
});

test("buildRows: invalid emails and nameless rows skipped, in-file duplicates collapsed, custom fields kept, counts honest", () => {
  const p = parseCsv(MESSY); const { rows, report } = buildRows(p, suggestMapping(p.headers));
  assert.equal(report.total, 5); assert.equal(rows.length, 2); assert.equal(report.skipped, 3);
  assert.deepEqual(report.reasons, { invalid_email: 1, missing_name: 1, duplicate_in_file: 1, duplicate_existing: 0, error: 0 });
  assert.equal(rows[0].name, "Acme Property Mgmt", "company wins as the prospect name"); assert.equal(rows[0].contact_name, "Smith, Jane"); assert.equal(rows[0].email, "jane@example.com", "email lower-cased");
  assert.deepEqual(rows[0].custom, { Notes: 'Met at expo, wants "quote"' });
  assert.equal(rows[1].name, "Bob Jones", "consumer lead: the person is the prospect"); assert.equal(rows[1].contact_name, "Bob Jones");
  assert.deepEqual(report.examples.invalid_email, ["not-an-email"]);
});
