import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeInput } from "../../lib/analyzer/run";
import { agentLine, buildRows, firstThreeTasks, DAY_PLAN } from "../../lib/analyzer/narrate";
import { websiteFixesFromHtml, detectChat, checkChat, checkWebsite } from "../../lib/analyzer/checks";
import { icpFor } from "../../lib/analyzer/icp";
import { DEFAULT_MODULES } from "../../lib/agentProgram/modules";
import type { Finding } from "../../lib/analyzer/types";

const f = (over: Partial<Finding>): Finding => ({ check: "presence", capability: "ai_presence", status: "found", headline: "x", items: [], reason: null, metrics: {}, sources: [], ...over });

test("input: URL-ish or social link only; a bare name needs a link", () => {
  assert.deepEqual(normalizeInput("limitlessroofingokc.com"), { url: "https://limitlessroofingokc.com/", domain: "limitlessroofingokc.com" });
  assert.equal(normalizeInput("https://www.Example.com/about")?.domain, "example.com");
  assert.equal(normalizeInput("Joe's Roofing"), null);
  assert.equal(normalizeInput(""), null);
});

test("honesty: agent lines never promise execution for unshipped capabilities", () => {
  const mods = DEFAULT_MODULES; // ai_presence live; everything else not
  assert.equal(agentLine("presence", f({ metrics: { issues: 7 } }), mods), "Your agent fixes all 7 on day 1.");
  const outbound = agentLine("outbound", f({ check: "outbound", capability: "outbound_gtm", metrics: { prospects: 230 } }), mods);
  assert.match(outbound, /takes this over when Outbound \/ GTM ships — you're first in line/);
  assert.doesNotMatch(outbound, /builds the list/);
  const reviews = agentLine("reviews", f({ check: "reviews", capability: "reviews_reputation", status: "missing", reason: "no key" }), mods);
  assert.match(reviews, /when Reviews & Reputation ships/);
  // Flip a capability live → the promise appears
  const live = mods.map((m) => (m.key === "outbound_gtm" ? { ...m, status: "live" as const } : m));
  assert.equal(agentLine("outbound", f({ check: "outbound", capability: "outbound_gtm", metrics: { prospects: 230 } }), live), "Your agent builds the list and writes the first sequence.");
});

test("rows: five days in order, pending until the finding lands", () => {
  const rows = buildRows([f({ metrics: { issues: 2 } })], DEFAULT_MODULES);
  assert.deepEqual(rows.map((r) => r.check), DAY_PLAN.map((d) => d.check));
  assert.equal(rows[0].agentLine, "Your agent fixes all 2 on day 1.");
  assert.equal(rows[1].finding, null); assert.equal(rows[1].agentLine, null);
  assert.equal(rows[0].live, true); assert.equal(rows[1].live, false);
});

test("first 3 trial tasks come only from LIVE capabilities with real findings", () => {
  const findings = [
    f({ metrics: { issues: 3 }, items: ["No meta description", "No schema.org", "No location"] }),
    f({ check: "outbound", capability: "outbound_gtm", metrics: { prospects: 230 }, items: ["a.com"] }),
    f({ check: "website", capability: "website", status: "missing", reason: "unreachable" }),
  ];
  const tasks = firstThreeTasks(findings, DEFAULT_MODULES);
  assert.equal(tasks.length, 3);
  assert.ok(tasks.every((t) => t.title.startsWith("AI Presence:")));
});

test("website fixes and chat detection come from the HTML, nothing else", () => {
  const html = `<html><head><title>Hi</title></head><body><h2>no h1</h2><form></form><script src="https://js.driftt.com/include/x.js"></script></body></html>`;
  const site = { ok: true, url: "https://x.com", finalUrl: "https://x.com/", html, ttfbMs: 2200, bytes: html.length, status: 200, reason: null };
  const { fixes } = websiteFixesFromHtml(site);
  assert.ok(fixes.some((x) => /Slow first byte \(2\.2s/.test(x)));
  assert.ok(fixes.some((x) => /thin <title>/.test(x)));
  assert.ok(fixes.some((x) => /No H1/.test(x)));
  assert.ok(fixes.some((x) => /No online booking — only a contact form/.test(x)));
  const w = checkWebsite(site);
  assert.equal(w.items.length, 3); assert.match(w.headline, /^3 quick-hit fixes/);
  assert.equal(detectChat(html), "Drift");
  assert.equal(checkChat(site).metrics.hasChat, 1);
  assert.equal(checkChat({ ...site, html: "<html></html>" }).headline, "No chat on your site — nobody answers after hours.");
  const down = checkWebsite({ ...site, ok: false, reason: "The site answered 503." });
  assert.equal(down.status, "missing"); assert.equal(down.reason, "The site answered 503.");
});

test("ICP presets: known category → preset; unknown → null (no invented ICP)", () => {
  assert.match(icpFor("Roofing Contractor")!.label, /property managers/);
  assert.equal(icpFor("Quantum Widget Foundry"), null);
  assert.equal(icpFor(null), null);
});
