import { test } from "node:test";
import assert from "node:assert/strict";
import { integrationRegistry, liveIntegrations } from "../../lib/integrations/registry";

test("registry keys are unique and every entry has a status and description", () => {
  const all = integrationRegistry();
  assert.equal(new Set(all.map((i) => i.key)).size, all.length);
  for (const i of all) { assert.ok(["live", "needs_setup", "planned"].includes(i.status), i.key); assert.ok(i.description.length > 10, i.key); }
});

test("marketing only ever sees live integrations; planned/needs_setup never leak", () => {
  const live = liveIntegrations();
  assert.ok(live.every((i) => i.status === "live"));
  assert.ok(live.some((i) => i.key === "google_calendar"), "Google Calendar is live");
  for (const k of ["gohighlevel", "zapier", "webhooks", "gmail", "meta", "slack", "notion", "apple_calendar"]) assert.ok(!live.some((i) => i.key === k), `${k} must not be shown`);
});

test("Stripe flips to live only when the secret key is configured", () => {
  const prev = process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_SECRET_KEY;
  assert.equal(integrationRegistry().find((i) => i.key === "stripe")!.status, "needs_setup");
  process.env.STRIPE_SECRET_KEY = "sk_test_x";
  assert.equal(integrationRegistry().find((i) => i.key === "stripe")!.status, "live");
  if (prev === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = prev;
});
