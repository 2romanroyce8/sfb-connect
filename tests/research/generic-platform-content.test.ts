// ============================================================
// Regression suite reproducing two real production incidents that survived
// the Sept 11 social-URL-normalization fix:
//
// INCIDENT 1 (Apify / meta.ai): a blocked Instagram profile seed returned
// Instagram's own generic login-wall content (HTTP 200, not a 4xx -- our
// fetcher can't execute JS, so Instagram's SPA shell looks identical for
// almost any URL when not authenticated). That generic content's title
// ("Instagram") got treated as the business name. That one-word name then
// trivially word-overlap-matched Apify's own "Instagram Scraper" marketing
// pages during gap-analysis wider-web search, and meta.ai (linked from
// Instagram's generic footer) was accepted as the "official website".
// Final stored result: business_name="Apify", website="https://meta.ai" --
// for a business (Clutter Solutions LLC) that has nothing to do with
// either.
//
// INCIDENT 2 (World Bank Group / arturoherrera.dev): a personal Facebook
// profile with a common human name triggered a name-only wider-web search
// that found a DIFFERENT real person/entity sharing that name, and that
// unrelated page's own strong JSON-LD identity ("World Bank Group")
// overwrote the result.
//
// Fix: GenericPlatformContent.ts excludes platform boilerplate from all
// identity extraction and further discovery; BusinessIdentityResolver.ts
// requires >=2 meaningful words before name-based fingerprint matching;
// LeadProfileBuilder.ts caps gap_analysis/search_discovery-sourced
// candidates at the weakest strength tier so they can never alone produce
// "verified" status or outrank direct-crawl evidence.
//
// Run with: npx tsx --test tests/research/generic-platform-content.test.ts
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { isGenericPlatformContent } from "../../lib/research/GenericPlatformContent";
import { buildFingerprint, matchesFingerprint } from "../../lib/research/BusinessIdentityResolver";
import { isInfrastructureUrl } from "../../lib/research/normalize";
import { buildLeadProfile } from "../../lib/research/LeadProfileBuilder";
import type { FetchedPage } from "../../lib/research/types";

function page(overrides: Partial<FetchedPage>): FetchedPage {
  return { url: "https://example.com", finalUrl: "https://example.com", ok: true, html: "", sourceType: "website", ...overrides };
}

// ---- Unit: isGenericPlatformContent ----
test("Instagram's real generic login-wall HTML (from the actual incident) is detected as generic", () => {
  const html = `<html><head><title>Instagram</title><meta property="og:title" content="Instagram"><meta name="description" content="Create an account or log in to Instagram - Share what you're into with the people who get you."></head><body></body></html>`;
  const p = page({ finalUrl: "https://www.instagram.com/cluttersolutions_llc?stkn=abc123", sourceType: "instagram", html });
  assert.equal(isGenericPlatformContent(p), true);
});

test("A bare platform root with no path segments is always generic, regardless of title", () => {
  const p = page({ finalUrl: "https://www.instagram.com/", sourceType: "instagram", html: `<html><head><title>Anything</title></head></html>` });
  assert.equal(isGenericPlatformContent(p), true);
});

test("A real business's own website is never flagged as generic platform content", () => {
  const p = page({ finalUrl: "https://clutterSolutionsLLC.com/", sourceType: "website", html: `<html><head><title>Clutter Solutions LLC | Junk Removal</title></head></html>` });
  assert.equal(isGenericPlatformContent(p), false);
});

test("A real, specific Facebook business page is not flagged as generic", () => {
  const p = page({
    finalUrl: "https://www.facebook.com/PjsRoofing/",
    sourceType: "facebook",
    html: `<html><head><title>PJ's Roofing | Frederick MD | Facebook</title></head></html>`,
  });
  assert.equal(isGenericPlatformContent(p), false);
});

// ---- Unit: fingerprint word-count gate ----
test("A single-word fingerprint (e.g. the platform's own generic name) never matches by name", () => {
  const fp = buildFingerprint({ name: "Instagram", domain: null, phone: null });
  assert.equal(matchesFingerprint(fp, { text: "Instagram Profile Scraper (Cookieless) - Apify" }), false);
});

test("A real two-word business name still matches a genuinely related page", () => {
  const fp = buildFingerprint({ name: "Clutter Solutions", domain: null, phone: null });
  assert.equal(matchesFingerprint(fp, { text: "Clutter Solutions LLC - Junk Removal & Hauling" }), true);
});

// ---- Unit: meta.ai denylist (defense-in-depth) ----
test("meta.ai is treated as platform infrastructure, never a website candidate", () => {
  assert.equal(isInfrastructureUrl("https://meta.ai"), true);
  assert.equal(isInfrastructureUrl("https://www.meta.ai/contact"), true);
});

// ---- Integration: full incident reproduction via buildLeadProfile, mocked fetch ----
type MockRoute = { status: number; body?: string };
function withMockedFetch<T>(routes: Record<string, MockRoute>, fn: () => Promise<T>): Promise<T> {
  const realFetch = global.fetch;
  global.fetch = (async (input: any) => {
    const url = typeof input === "string" ? input : input.url;
    const route = routes[url];
    if (!route) throw new Error(`Unmocked URL in test: ${url}`);
    return { ok: route.status >= 200 && route.status < 300, status: route.status, url, text: async () => route.body ?? "" } as Response;
  }) as typeof fetch;
  return fn().finally(() => {
    global.fetch = realFetch;
  });
}
const PADDING = "x".repeat(2100);

test("Incident 1 reproduction — blocked Instagram profile no longer resolves to Apify/meta.ai", async () => {
  const seed = "https://www.instagram.com/cluttersolutions_llc";
  const genericHtml = `<html><head><title>Instagram</title><meta property="og:title" content="Instagram"><meta name="description" content="Create an account or log in to Instagram - Share what you're into with the people who get you."></head><body><a href="https://meta.ai">Meta AI</a>${PADDING}</body></html>`;
  const routes: Record<string, MockRoute> = {
    [seed]: { status: 200, body: genericHtml },
    "https://meta.ai/": { status: 403 },
    "https://meta.ai": { status: 403 },
  };
  await withMockedFetch(routes, async () => {
    const { graph } = await buildLeadProfile([seed], undefined, "public_web");
    const website = graph.contactMethods.find((c) => c.type === "website")?.value;
    assert.notEqual(website, "https://meta.ai", "meta.ai must never be accepted as the official website");
    assert.notEqual(graph.businessName?.value?.toLowerCase(), "instagram", "the platform's own generic title must never become the business name");
  });
});

test("Real, specific Facebook business content still resolves normally (no regression)", async () => {
  const seed = "https://www.facebook.com/PjsRoofing";
  const html = `<html><head><title>PJ's Roofing | Frederick MD | Facebook</title></head><body>Call (301) 695-4754. ${PADDING}</body></html>`;
  await withMockedFetch({ [seed]: { status: 200, body: html } }, async () => {
    const { graph } = await buildLeadProfile([seed], undefined, "website_only");
    assert.equal(graph.businessName?.value, "PJ's Roofing");
    assert.equal(graph.contactMethods.find((c) => c.type === "phone")?.value, "+13016954754");
  });
});
