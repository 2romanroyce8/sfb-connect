import { test } from "node:test";
import assert from "node:assert/strict";
import { integrationRegistry, liveOf, stripTagline } from "../../lib/integrations/registry";
import { OAUTH_PROVIDERS } from "../../lib/integrations/providers";

const bare = { env: {}, verified: new Set<string>() };

test("registry keys are unique and every entry has a status, description and connect kind", () => {
  const all = integrationRegistry(bare);
  assert.equal(new Set(all.map((i) => i.key)).size, all.length);
  for (const i of all) { assert.ok(["live", "needs_setup", "planned"].includes(i.status), i.key); assert.ok(i.description.length > 10, i.key); assert.ok(i.connectKind, i.key); }
  assert.ok(all.some((i) => i.key === "linkedin"), "LinkedIn is registered");
});

test("with nothing configured or verified, only the self-contained integrations are live", () => {
  const live = liveOf(integrationRegistry(bare)).map((i) => i.key).sort();
  assert.deepEqual(live, ["google_calendar", "webhooks", "zapier"]);
});

test("every live integration has an official logo (marketing never shows a generic icon)", () => {
  const env = { RESEND_API_KEY: "re_x", STRIPE_SECRET_KEY: "sk_test_x", GHL_CLIENT_ID: "a", GHL_CLIENT_SECRET: "b", GOOGLE_CLIENT_ID: "a", GOOGLE_CLIENT_SECRET: "b", META_APP_ID: "a", META_APP_SECRET: "b", SLACK_CLIENT_ID: "a", SLACK_CLIENT_SECRET: "b", NOTION_CLIENT_ID: "a", NOTION_CLIENT_SECRET: "b", LINKEDIN_CLIENT_ID: "a", LINKEDIN_CLIENT_SECRET: "b" };
  const all = integrationRegistry({ env, verified: new Set(["gmail", "meta", "slack", "notion", "linkedin"]) });
  assert.equal(liveOf(all).length, all.length - 1, "everything live when configured + verified, except parked GoHighLevel");
  assert.equal(all.find((i) => i.key === "gohighlevel")!.status, "planned", "GHL is parked");
  for (const i of liveOf(all)) assert.ok(i.logo, `${i.key} needs a logo`);
});

test("OAuth providers: configured but unverified stays needs_setup; verified without credentials stays needs_setup", () => {
  const env = { SLACK_CLIENT_ID: "a", SLACK_CLIENT_SECRET: "b" };
  assert.equal(integrationRegistry({ env, verified: new Set() }).find((i) => i.key === "slack")!.status, "needs_setup");
  assert.equal(integrationRegistry({ env, verified: new Set(["slack"]) }).find((i) => i.key === "slack")!.status, "live");
  assert.equal(integrationRegistry({ env: {}, verified: new Set(["slack"]) }).find((i) => i.key === "slack")!.status, "needs_setup");
  for (const p of Object.values(OAUTH_PROVIDERS)) assert.ok(p.env.clientId.endsWith("_ID") && p.env.clientSecret.endsWith("_SECRET"), p.key);
});

test("Stripe flips to live only when the secret key is configured", () => {
  assert.equal(integrationRegistry(bare).find((i) => i.key === "stripe")!.status, "needs_setup");
  assert.equal(integrationRegistry({ ...bare, env: { STRIPE_SECRET_KEY: "sk_test_x" } }).find((i) => i.key === "stripe")!.status, "live");
});

test("strip tagline is tempered under three live integrations", () => {
  assert.match(stripTagline(2), /only once they're live/);
  assert.match(stripTagline(3), /no rip-and-replace/);
});

test("Resend is a system service: live iff RESEND_API_KEY is set, never customer-connectable", () => {
  const off = integrationRegistry(bare).find((i) => i.key === "resend")!;
  assert.equal(off.status, "needs_setup"); assert.equal(off.connectKind, "system");
  const on = integrationRegistry({ ...bare, env: { RESEND_API_KEY: "re_x" } }).find((i) => i.key === "resend")!;
  assert.equal(on.status, "live"); assert.ok(on.logo, "official Resend mark present");
});
