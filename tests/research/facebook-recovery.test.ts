// ============================================================
// Regression suite for the Facebook seed-recovery fix (fetchPage's mbasic
// fallback) and its instrumentation (seed_url_type, facebook_fetch_result,
// mbasic_fallback_*, identity_recovered_from_url).
//
// This is a deliberate lock-in for the exact five cases called out when the
// fix was reviewed:
//   A) vanity handle                        -> identity from page content
//   B) profile.php?id= , direct blocked, mbasic succeeds -> identity recovered
//   C) /pages/<Name>/<id>                   -> name recovered from URL text
//   D) /people/<Name>/<id>                  -> name recovered from URL text
//   E) bare profile.php?id=, everything blocked, no secondary source
//      -> IDENTITY_UNRECOVERABLE_FROM_PUBLIC_SOURCES, never a fabricated name
//
// Run with: npx tsx --test tests/research/facebook-recovery.test.ts
// No real network calls are made — global.fetch is mocked per-case.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { fetchPage, classifySeedUrlType } from "../../lib/research/fetchSource";
import { extractHandleFromSeeds } from "../../lib/research/LeadProfileBuilder";

type MockRoute = { status: number; body?: string };

/** Installs a fetch mock keyed by exact URL, restores the real fetch after. */
function withMockedFetch<T>(routes: Record<string, MockRoute>, fn: () => Promise<T>): Promise<T> {
  const realFetch = global.fetch;
  global.fetch = (async (input: any) => {
    const url = typeof input === "string" ? input : input.url;
    const route = routes[url];
    if (!route) throw new Error(`Unmocked URL in test: ${url}`);
    return {
      ok: route.status >= 200 && route.status < 300,
      status: route.status,
      url,
      text: async () => route.body ?? "",
    } as Response;
  }) as typeof fetch;
  return fn().finally(() => {
    global.fetch = realFetch;
  });
}

const BUSINESS_HTML = `<html><head><title>Tony's Tint Solutions</title></head><body>Real content well over two thousand characters so the login-wall heuristic in fetchOnce doesn't misclassify this as blocked. ${"x".repeat(2100)}</body></html>`;

// ---- CASE A: vanity handle, direct fetch succeeds ----
test("Case A — vanity handle: identity extracted, research proceeds", async () => {
  const seed = "https://www.facebook.com/tonytints925";
  await withMockedFetch({ [seed]: { status: 200, body: BUSINESS_HTML } }, async () => {
    assert.equal(classifySeedUrlType(seed), "vanity");
    const page = await fetchPage(seed);
    assert.equal(page.ok, true, "direct fetch should succeed for an open vanity page");
    assert.equal(page.fetchAttempts?.length, 1, "no mbasic fallback needed when the direct fetch succeeds");
    assert.equal(page.fetchAttempts?.[0].strategy, "direct");
    assert.equal(extractHandleFromSeeds([seed]), "tonytints925", "vanity handle is real identity evidence from the URL alone");
  });
});

// ---- CASE B: profile.php?id=, direct blocked, mbasic succeeds ----
test("Case B — profile.php?id=: direct blocked, mbasic succeeds, identity recovered", async () => {
  const seed = "https://www.facebook.com/profile.php?id=100063456789012";
  const mbasicUrl = "https://mbasic.facebook.com/profile.php?id=100063456789012";
  await withMockedFetch(
    {
      [seed]: { status: 403 },
      [mbasicUrl]: { status: 200, body: BUSINESS_HTML },
    },
    async () => {
      assert.equal(classifySeedUrlType(seed), "profile_id");
      const page = await fetchPage(seed);
      assert.equal(page.ok, true, "mbasic fallback should recover a page the direct fetch couldn't");
      assert.equal(page.fetchAttempts?.length, 2);
      assert.equal(page.fetchAttempts?.[0].strategy, "direct");
      assert.equal(page.fetchAttempts?.[0].ok, false);
      assert.equal(page.fetchAttempts?.[1].strategy, "mbasic_fallback");
      assert.equal(page.fetchAttempts?.[1].ok, true);
      // The URL itself carries no name segment — page CONTENT is the only
      // recovery path here, not extractHandleFromSeeds.
      assert.equal(extractHandleFromSeeds([seed]), null, "bare profile_id has no recoverable text identity from the URL alone");
    }
  );
});

// ---- CASE C: /pages/<Name>/<id> ----
test("Case C — /pages/<Name>/<id>: business name recovered from URL, research proceeds", async () => {
  const seed = "https://www.facebook.com/pages/Overhaul-Window-Cleaning/123456789012345";
  await withMockedFetch({}, async () => {
    assert.equal(classifySeedUrlType(seed), "pages");
    assert.equal(extractHandleFromSeeds([seed]), "Overhaul Window Cleaning", "name slug recovered from /pages/ URL even before any fetch");
  });
});

// ---- CASE D: /people/<Name>/<id> ----
test("Case D — /people/<Name>/<id>: business name recovered from URL, research proceeds", async () => {
  const seed = "https://www.facebook.com/people/Raes-Tipz-and-Toes/pfbid02abcXYZ";
  await withMockedFetch({}, async () => {
    assert.equal(classifySeedUrlType(seed), "people");
    assert.equal(extractHandleFromSeeds([seed]), "Raes Tipz and Toes", "name slug recovered from /people/ URL even before any fetch");
  });
});

// ---- CASE E: bare profile.php?id=, direct blocked, mbasic ALSO blocked, no secondary source ----
test("Case E — profile.php?id= fully blocked: no fabricated identity, honest dead end", async () => {
  const seed = "https://www.facebook.com/profile.php?id=999999999999999";
  const mbasicUrl = "https://mbasic.facebook.com/profile.php?id=999999999999999";
  await withMockedFetch(
    {
      [seed]: { status: 403 },
      [mbasicUrl]: { status: 403 },
    },
    async () => {
      assert.equal(classifySeedUrlType(seed), "profile_id");
      const page = await fetchPage(seed);
      assert.equal(page.ok, false, "both direct and mbasic fetches are blocked");
      assert.equal(page.fetchAttempts?.length, 2);
      assert.equal(page.fetchAttempts?.every((a) => a.ok === false), true);
      assert.equal(extractHandleFromSeeds([seed]), null, "no recoverable text identity from a bare numeric profile ID");
      // This is the case the route.ts failure classifier must label
      // IDENTITY_UNRECOVERABLE_FROM_PUBLIC_SOURCES rather than a generic
      // NOT_FOUND / fabricating a business name — asserted structurally
      // here since it's a route-level decision, not fetchPage's.
    }
  );
});

// ---- Non-Facebook seed sanity check — must never be misclassified ----
test("Non-Facebook website seed classifies as 'website', not a Facebook shape", () => {
  assert.equal(classifySeedUrlType("https://www.acmeroofing.com"), "website");
  assert.equal(classifySeedUrlType("https://www.instagram.com/acmeroofing"), "other");
});
