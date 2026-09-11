// ============================================================
// Regression suite for the crawl-frontier dedupe fix.
//
// The bug: urlKey() deduped the discovery queue by canonicalDomain() (host
// only), so once ANY page on a domain was visited, every other page on that
// same domain (e.g. /about, /contact, /services discovered from the
// homepage) was treated as already-queued and silently never fetched.
// A business's research profile was effectively capped at one page per
// site, no matter how many real sub-pages actually existed.
//
// The fix splits the concept in two:
//   domainKey() (== canonicalDomain, unchanged) -- entity/domain identity
//   pageKey()                                    -- crawl-frontier identity
// plus a per-domain crawl budget + priority scoring so fixing the dedupe
// bug doesn't flip into the opposite failure mode (one site consuming the
// entire research budget on low-value pages).
//
// Run with: npx tsx --test tests/research/crawl-frontier.test.ts
// No real network calls — global.fetch is mocked per case.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { pageKey, domainKey } from "../../lib/research/normalize";
import { isRejectedPath, sortByPriority, MAX_PAGES_PER_DOMAIN } from "../../lib/research/CrawlPriority";
import { buildLeadProfile } from "../../lib/research/LeadProfileBuilder";

type MockRoute = { status: number; body?: string };

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

const PADDING = "x".repeat(2100); // clears fetchOnce's login-wall length heuristic

// ---- TEST 1: distinct meaningful pages on one domain must all be able to coexist ----
test("Test 1 — homepage, about, contact, services all get distinct frontier keys", () => {
  const keys = [
    "https://example.com",
    "https://example.com/about",
    "https://example.com/contact",
    "https://example.com/services",
  ].map(pageKey);
  assert.equal(new Set(keys).size, 4, "each real page must have its own key");
});

// ---- TEST 2: URL variants of the SAME page must collapse to one key ----
test("Test 2 — www / trailing slash / tracking param variants collapse to one page key", () => {
  const variants = ["https://www.example.com/contact/", "https://example.com/contact", "https://example.com/contact?utm_source=facebook"];
  const keys = variants.map(pageKey);
  assert.equal(new Set(keys).size, 1, `expected all variants to collapse, got: ${JSON.stringify(keys)}`);
});

// ---- TEST 3: a sub-path under a matched page is still a distinct page ----
test("Test 3 — /services and /services/roofing are distinct pages", () => {
  assert.notEqual(pageKey("https://example.com/services"), pageKey("https://example.com/services/roofing"));
});

// ---- TEST 4: semantically meaningful query params stay distinct ----
test("Test 4 — different ?id= values remain distinct pages", () => {
  assert.notEqual(pageKey("https://example.com/page?id=123"), pageKey("https://example.com/page?id=456"));
});

// ---- domainKey must still collapse everything to the entity/domain level ----
test("domainKey() still treats every page on a domain as the same entity", () => {
  const domains = ["https://example.com", "https://www.example.com/about", "https://example.com/contact?utm_source=x"].map(domainKey);
  assert.equal(new Set(domains).size, 1, "domain-level identity must be unaffected by the page-level fix");
});

// ---- TEST 5: priority selection within a domain budget, not FIFO over everything ----
test("Test 5 — priority ordering puts contact/about/services ahead of gallery/blog", () => {
  const discovered = [
    "https://example.com/blog/post-1",
    "https://example.com/gallery",
    "https://example.com/services",
    "https://example.com/blog/post-2",
    "https://example.com/contact",
    "https://example.com/about",
    "https://example.com/blog/post-3",
  ];
  const ordered = sortByPriority(discovered);
  const top3 = ordered.slice(0, 3);
  assert.ok(top3.includes("https://example.com/contact"), "contact should be prioritized");
  assert.ok(top3.includes("https://example.com/about"), "about should be prioritized");
  assert.ok(top3.includes("https://example.com/services"), "services should be prioritized");
  assert.ok(ordered.indexOf("https://example.com/contact") < ordered.indexOf("https://example.com/blog/post-1"), "contact must rank above blog posts");
});

test("Test 5b — reject-listed pages (admin/login/cart/privacy/terms) never make the cut", () => {
  const discovered = [
    "https://example.com/wp-admin/edit.php",
    "https://example.com/login",
    "https://example.com/cart",
    "https://example.com/privacy-policy",
    "https://example.com/terms-of-service",
    "https://example.com/contact",
  ];
  const ordered = sortByPriority(discovered);
  assert.deepEqual(ordered, ["https://example.com/contact"], "every reject-listed URL must be filtered out entirely");
});

test("isRejectedPath — asset/document extensions and paginated archives are rejected", () => {
  assert.equal(isRejectedPath("https://example.com/brochure.pdf"), true);
  assert.equal(isRejectedPath("https://example.com/team/headshot.jpg"), true);
  assert.equal(isRejectedPath("https://example.com/blog?page=4"), true);
  assert.equal(isRejectedPath("https://example.com/tag/roofing"), true);
  assert.equal(isRejectedPath("https://example.com/contact"), false);
});

// ---- TEST 5 (integration): per-domain budget actually caps enqueued pages ----
test("Test 5 (integration) — a domain with more candidate pages than budget only gets MAX_PAGES_PER_DOMAIN worth crawled", async () => {
  const home = "https://manylinks.example.com";
  // Build far more PRIORITY_SLUGS-matching links than the budget allows —
  // team/<n> matches the "team" slug for every one of 40 fake employees.
  const teamLinks = Array.from({ length: 40 }, (_, i) => `<a href="/team/employee-${i}">Employee ${i}</a>`).join("\n");
  const homeHtml = `<html><body>
    <a href="/contact">Contact</a>
    <a href="/about">About</a>
    ${teamLinks}
    ${PADDING}
  </body></html>`;

  const routes: Record<string, MockRoute> = { [`${home}/`]: { status: 200, body: homeHtml }, [home]: { status: 200, body: homeHtml } };
  // Every possible team/contact/about sub-page also needs a mock route in
  // case it gets fetched — real content, so a fetched page still counts as
  // a successfully-visited source either way.
  for (let i = 0; i < 40; i++) routes[`https://manylinks.example.com/team/employee-${i}`] = { status: 200, body: `<html><body>Employee ${i}. ${PADDING}</body></html>` };
  routes[`${home}/contact`] = { status: 200, body: `<html><body>Call (555) 123-4567. ${PADDING}</body></html>` };
  routes[`${home}/about`] = { status: 200, body: `<html><body>About us. ${PADDING}</body></html>` };

  await withMockedFetch(routes, async () => {
    const { allPages } = await buildLeadProfile([home], undefined, "website_only");
    // website_only skips bio/social expansion but NOT website sub-page
    // discovery -- so this is a genuine test of the per-domain budget.
    const fetchedFromDomain = allPages.filter((p) => domainKey(p.finalUrl) === "manylinks.example.com");
    assert.ok(fetchedFromDomain.length <= MAX_PAGES_PER_DOMAIN, `expected at most ${MAX_PAGES_PER_DOMAIN} pages fetched from one domain, got ${fetchedFromDomain.length}`);
    assert.ok(fetchedFromDomain.length > 1, "the fix should still crawl MORE than just the homepage");
  });
});

// ---- TEST 6: homepage fails, /contact succeeds — evidence still counted ----
test("Test 6 — homepage unreachable but /contact succeeds: contact evidence still recovered", async () => {
  const home = "https://brokenhome.example.com";
  const routes: Record<string, MockRoute> = {
    [home]: { status: 403 },
    [`${home}/`]: { status: 403 },
    [`${home}/contact`]: { status: 200, body: `<html><body>Call us at (555) 987-6543. ${PADDING}</body></html>` },
    [`${home}/about`]: { status: 403 },
  };
  await withMockedFetch(routes, async () => {
    const { graph } = await buildLeadProfile([home], undefined, "website_only");
    const phone = graph.contactMethods.find((c) => c.type === "phone");
    assert.equal(phone?.value, "+15559876543", "phone evidence from /contact must be recovered even though the homepage itself 403'd");
  });
});

// ---- TEST 7: same domain via multiple discovery sources — domain identity vs. page frontier ----
test("Test 7 — domain-level identity dedupes ownership, page-level frontier still allows new URLs", () => {
  const alreadyVisited = new Set([pageKey("https://example.com/")]);
  const rediscoveredHomepage = "https://www.example.com"; // same page, different source
  const newPage = "https://example.com/services"; // genuinely new page, same domain

  assert.equal(alreadyVisited.has(pageKey(rediscoveredHomepage)), true, "re-discovering the same homepage from a second source must not look like a new page");
  assert.equal(alreadyVisited.has(pageKey(newPage)), false, "a genuinely new page on the same domain must still be crawlable");
  // But domain-level identity correctly says these all belong to one business:
  assert.equal(domainKey("https://example.com/") === domainKey(rediscoveredHomepage) && domainKey(rediscoveredHomepage) === domainKey(newPage), true);
});
