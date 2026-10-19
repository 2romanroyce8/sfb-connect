import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanEmail, selectLeads, type CrmLeadRow } from "../../lib/outbound/fromCrm";

const L = (id: string, name: string, email: string | null, city: string, t: string): CrmLeadRow => ({ id, business_name: name, website: null, email, phone: null, city, state: "TX", custom_fields: {}, created_at: t });

test("placeholders and blanks are skipped", () => {
  for (const e of ["", null, "n/a", "N/A", "—", "-", "--", "[email protected]", "none"]) assert.equal(cleanEmail(e as string).email, null, String(e));
  assert.equal(cleanEmail(" Sales@JaMarRoofing.com ").email, "sales@jamarroofing.com");
  assert.equal(cleanEmail("bad-email").reason, "invalid_email");
});

test("shared inbox becomes one prospect; oldest office wins; already-listed skipped", () => {
  const r = selectLeads([
    L("2", "Ja-Mar Roofing & Sheet Metal", "sales@jamarroofing.com", "San Antonio", "2026-10-19T01:00:00Z"),
    L("1", "Ja-Mar Roofing & Sheet Metal", "SALES@jamarroofing.com", "Austin", "2026-10-19T00:00:00Z"),
    L("3", "Sunshine Roofing", "n/a", "Tampa", "2026-10-19T00:00:00Z"),
    L("4", "Old Friend Roofing", "hi@old.com", "Waco", "2026-10-19T00:00:00Z"),
  ], new Set(["hi@old.com"]));
  assert.deepEqual(r.keep.map((k) => [k.id, k.city, k.merged]), [["1", "Austin", ["2"]]]);
  assert.deepEqual(r.skipped.map((s) => s.reason).sort(), ["already_on_list", "duplicate_in_tag", "placeholder_email"]);
});
