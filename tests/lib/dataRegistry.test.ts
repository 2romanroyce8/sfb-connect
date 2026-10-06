import { test } from "node:test";
import assert from "node:assert/strict";
import { DATA_CATEGORIES, RESET_CATEGORIES, CATEGORY_BY_KEY, isDeletableCategory, rowLabel } from "../../lib/team/dataRegistry";

test("registry never exposes identity, auth, agent, billing or customer tables", () => {
  const forbidden = /^(users|auth|agent_|businesses|payments|credit_|billing_|stripe_|addon_|customer_|crm_calendar_connections)/;
  for (const c of DATA_CATEGORIES) assert.ok(!forbidden.test(c.table), c.table);
  assert.equal(isDeletableCategory("users"), false);
  assert.equal(isDeletableCategory("agent_authorizations"), false);
});

test("keys are unique and reset lists children before parents", () => {
  assert.equal(new Set(DATA_CATEGORIES.map((c) => c.key)).size, DATA_CATEGORIES.length);
  const order = RESET_CATEGORIES.map((c) => c.table);
  const before = (child: string, parent: string) => assert.ok(order.indexOf(child) < order.indexOf(parent), `${child} must precede ${parent}`);
  before("crm_audit_categories", "crm_audits"); before("crm_audits", "crm_leads"); before("crm_research_sources", "crm_research_results"); before("crm_research_jobs", "crm_research_results"); before("crm_work_plan_items", "crm_work_plans");
});

test("config tables are excluded from reset but still individually deletable", () => {
  for (const k of ["document_folders", "markets", "competition_rules"]) { assert.equal(CATEGORY_BY_KEY.get(k)?.inReset, false); assert.ok(isDeletableCategory(k)); }
});

test("rowLabel prefers a human field and falls back to id", () => {
  assert.equal(rowLabel({ id: "x", business_name: "Supreme Air LLC" }), "Supreme Air LLC");
  assert.equal(rowLabel({ id: "abc" }), "abc");
});
