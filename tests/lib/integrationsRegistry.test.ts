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
  const env = { RESEND_API_KEY: "re_x", STRIPE_SECRET_KEY: "sk_test_x", GHL_CLIENT_ID: "a", GHL_CLIENT_SECRET: "b", GOOGLE_CLIENT_ID: "a", GOOGLE_CLIENT_SECRET: "b", META_APP_ID: "a", META_APP_SECRET: "b", SLACK_CLIENT_ID: "a", SLACK_CLIENT_SECRET: "b", NOTION_CLIENT_ID: "a", NOTION_CLIENT_SECRET: "b", LINKEDIN_CLIENT_ID: "a", LINKEDIN_CLIENT_SECRET: "b", MICROSOFT_CLIENT_ID: "a", MICROSOFT_CLIENT_SECRET: "b", HUBSPOT_CLIENT_ID: "a", HUBSPOT_CLIENT_SECRET: "b", QUICKBOOKS_CLIENT_ID: "a", QUICKBOOKS_CLIENT_SECRET: "b", TIKTOK_CLIENT_KEY: "a", TIKTOK_CLIENT_SECRET: "b", WHATSAPP_PHONE_NUMBER_ID: "1", WHATSAPP_ACCESS_TOKEN: "t" };
  const all = integrationRegistry({ env, verified: new Set(["gmail", "meta", "slack", "notion", "linkedin", "google_business_profile", "outlook", "hubspot", "quickbooks", "whatsapp", "tiktok"]) });
  assert.equal(liveOf(all).length, all.length - 1, "everything live when configured + verified, except parked GoHighLevel");
  assert.equal(all.find((i) => i.key === "gohighlevel")!.status, "planned", "GHL is parked");
  for (const i of liveOf(all)) assert.ok(i.logo, `${i.key} needs a logo`);
});

test("OAuth providers: configured but unverified stays needs_setup; verified without credentials stays needs_setup", () => {
  const env = { SLACK_CLIENT_ID: "a", SLACK_CLIENT_SECRET: "b" };
  assert.equal(integrationRegistry({ env, verified: new Set() }).find((i) => i.key === "slack")!.status, "needs_setup");
  assert.equal(integrationRegistry({ env, verified: new Set(["slack"]) }).find((i) => i.key === "slack")!.status, "live");
  assert.equal(integrationRegistry({ env: {}, verified: new Set(["slack"]) }).find((i) => i.key === "slack")!.status, "needs_setup");
  for (const p of Object.values(OAUTH_PROVIDERS)) assert.ok(/_(ID|KEY)$/.test(p.env.clientId) && p.env.clientSecret.endsWith("_SECRET"), p.key);
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

import { AI_DISCOVERY_PLATFORMS } from "../../components/home/PlatformsSection";
test("WORKS WITH and AI DISCOVERY never mix: no AI assistant is a registry entry, and the discovery list has no connectable integration", () => {
  const reg = integrationRegistry({ env: {} as never, verified: new Set() });
  const regNames = new Set(reg.map((i) => i.name.toLowerCase()));
  for (const p of AI_DISCOVERY_PLATFORMS) assert.ok(!regNames.has(p.name.toLowerCase()), `${p.name} must not be in the integrations registry`);
  const ai = new Set(AI_DISCOVERY_PLATFORMS.map((p) => p.name.toLowerCase()));
  for (const i of reg) assert.ok(!ai.has(i.name.toLowerCase()), `${i.name} must not be in AI Discovery`);
  assert.deepEqual(AI_DISCOVERY_PLATFORMS.map((p) => p.name), ["ChatGPT", "Claude", "Perplexity", "Grok", "Gemini", "AI Search", "AI Assistants"]);
});

test("six new integrations (2026-10-10): registered, never live without keys + verified connection, exact env names and redirects", () => {
  const keys = ["google_business_profile", "outlook", "hubspot", "quickbooks", "whatsapp", "tiktok"];
  const none = integrationRegistry(bare);
  for (const k of keys) { const i = none.find((x) => x.key === k)!; assert.ok(i, k); assert.equal(i.status, "needs_setup", `${k} must not be live with nothing configured`); assert.ok(i.logo, `${k} has an official mark`); }
  // configured but unverified → still needs_setup
  const env = { GOOGLE_CLIENT_ID: "a", GOOGLE_CLIENT_SECRET: "b", MICROSOFT_CLIENT_ID: "a", MICROSOFT_CLIENT_SECRET: "b", WHATSAPP_PHONE_NUMBER_ID: "1", WHATSAPP_ACCESS_TOKEN: "t" };
  const cfg = integrationRegistry({ env, verified: new Set() });
  for (const k of ["google_business_profile", "outlook", "whatsapp"]) assert.equal(cfg.find((x) => x.key === k)!.status, "needs_setup", k);
  const ver = integrationRegistry({ env, verified: new Set(["google_business_profile", "outlook", "whatsapp"]) });
  for (const k of ["google_business_profile", "outlook", "whatsapp"]) assert.equal(ver.find((x) => x.key === k)!.status, "live", k);
  assert.deepEqual(OAUTH_PROVIDERS.outlook.env, { clientId: "MICROSOFT_CLIENT_ID", clientSecret: "MICROSOFT_CLIENT_SECRET" });
  assert.deepEqual(OAUTH_PROVIDERS.google_business_profile.env, { clientId: "GOOGLE_CLIENT_ID", clientSecret: "GOOGLE_CLIENT_SECRET" });
  assert.deepEqual(OAUTH_PROVIDERS.quickbooks.env, { clientId: "QUICKBOOKS_CLIENT_ID", clientSecret: "QUICKBOOKS_CLIENT_SECRET" });
  assert.deepEqual(OAUTH_PROVIDERS.hubspot.env, { clientId: "HUBSPOT_CLIENT_ID", clientSecret: "HUBSPOT_CLIENT_SECRET" });
  assert.deepEqual(OAUTH_PROVIDERS.tiktok.env, { clientId: "TIKTOK_CLIENT_KEY", clientSecret: "TIKTOK_CLIENT_SECRET" });
  assert.ok(OAUTH_PROVIDERS.outlook.scopes.includes("Calendars.ReadWrite") && OAUTH_PROVIDERS.outlook.scopes.includes("Mail.Send"));
  assert.ok(OAUTH_PROVIDERS.google_business_profile.scopes.some((s) => s.endsWith("/business.manage")));
  assert.deepEqual(OAUTH_PROVIDERS.quickbooks.scopes, ["com.intuit.quickbooks.accounting"]);
  assert.deepEqual(OAUTH_PROVIDERS.hubspot.scopes, ["crm.objects.contacts.read", "crm.objects.contacts.write"]);
  // UI notes surface where Roman asked
  assert.match(none.find((x) => x.key === "google_business_profile")!.blocker!, /per-location business verification/);
  assert.match(none.find((x) => x.key === "whatsapp")!.blocker!, /dedicated business number/);
  assert.match(none.find((x) => x.key === "tiktok")!.blocker!, /app review/);
  // AI assistants are never registry entries
  for (const n of ["chatgpt", "claude", "perplexity", "grok", "gemini"]) assert.ok(!none.some((i) => i.key === n || i.name.toLowerCase() === n), n);
});
