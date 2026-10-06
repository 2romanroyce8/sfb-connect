import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { tiktokAdapter, xAdapter, linkedinAdapter, instagramAdapter, facebookAdapter, adapterForUrl } from "../../lib/research/sources/adapters";
import { parsePublicIndexResults, recoverFromPublicIndex } from "../../lib/research/sources/publicIndex";
import { reconcileGraph, saveBlockReason, classifySeedSourceType } from "../../lib/research/reconcile";
import type { BusinessGraph, FetchedPage } from "../../lib/research/types";
import type { DiscoveryResult, DiscoveryProvider } from "../../lib/research/providers/types";

// Fixtures trimmed from the REAL pages fetched 2026-10-05 (tiktok.com/@1800gotjunk, x.com/1800GOTJUNK, linkedin.com/company/1-800-got-junk)
const FIX = JSON.parse(readFileSync(new URL("../fixtures/social-pages.json", import.meta.url), "utf8")) as Record<string, string>;
const page = (url: string, html: string, sourceType: string): FetchedPage => ({ url, finalUrl: url, ok: true, html, sourceType });
const now = new Date().toISOString();
const r = (url: string, title: string | null, description: string | null): DiscoveryResult => ({ url, title, description, provider: "exa", rank: 1, discoveredAt: now });

test("adapter routing: one adapter per platform URL, exact handles, reserved routes rejected", () => {
  assert.equal(adapterForUrl("https://www.tiktok.com/@1800gotjunk")?.platform, "tiktok");
  assert.equal(tiktokAdapter.handleFromUrl("https://www.tiktok.com/@1800GotJunk?lang=en"), "1800gotjunk");
  assert.equal(tiktokAdapter.handleFromUrl("https://www.tiktok.com/discover"), null);
  assert.equal(xAdapter.handleFromUrl("https://twitter.com/1800GOTJUNK"), "1800gotjunk");
  assert.equal(xAdapter.handleFromUrl("https://x.com/i/flow/login"), null);
  assert.equal(linkedinAdapter.handleFromUrl("https://www.linkedin.com/company/1-800-got-junk/"), "company/1-800-got-junk");
  assert.equal(linkedinAdapter.handleFromUrl("https://ca.linkedin.com/in/scudamore"), "in/scudamore");
  assert.equal(linkedinAdapter.handleFromUrl("https://www.linkedin.com/jobs/view/123"), null);
  assert.equal(facebookAdapter.handleFromUrl("https://www.facebook.com/profile.php?id=61593970382006"), "profile.php?id=61593970382006");
  assert.equal(instagramAdapter.handleFromUrl("https://instagram.com/p/abc/"), null);
});

test("TikTok adapter reads the platform's own published flags and bio from the hydration JSON; the <title> is platform chrome", () => {
  const ex = tiktokAdapter.extractProfile(page("https://www.tiktok.com/@1800gotjunk", FIX.tiktok, "tiktok"))!;
  assert.equal(ex.handle, "1800gotjunk");
  assert.equal(ex.displayName, "1800gotjunk");
  assert.equal(typeof ex.flags.business, "boolean"); // real flag, whatever its value for this account
  assert.equal(ex.flags.private, false);
  assert.equal(ex.platform, "tiktok");
});

test("X adapter reads display name + @handle from og:title and the bio from og:description", () => {
  const ex = xAdapter.extractProfile(page("https://x.com/1800GOTJUNK", FIX.x, "x"))!;
  assert.equal(ex.displayName, "1-800-GOT-JUNK?");
  assert.equal(ex.handle, "1800gotjunk");
  assert.equal(ex.bio, "We make junk disappear. All you have to do is point!");
});

test("LinkedIn company adapter reads name, About, and the structured company facts (website, industry, size, HQ, specialties)", () => {
  const ex = linkedinAdapter.extractProfile(page("https://www.linkedin.com/company/1-800-got-junk/", FIX.linkedin_company, "linkedin"))!;
  assert.equal(ex.displayName, "1-800-GOT-JUNK?");
  assert.equal(ex.website, "https://www.1800gotjunk.com/");
  assert.equal(ex.category, "Consumer Services");
  assert.equal(ex.companyFacts?.headquarters, "Vancouver, BC");
  assert.ok(ex.companyFacts!.specialties!.includes("Junk Removal"));
  assert.ok(ex.bio!.startsWith("We make junk disappear"));
  assert.equal(ex.flags.business, true);
  assert.equal(ex.urlKind, "company");
});

test("LinkedIn exact-slug attribution: linkedin.com/in/scudamore is NOT linkedin.com/in/brianscudamore, even if it is the same person", () => {
  const res = r("https://www.linkedin.com/in/scudamore", "Brian Scudamore", "Founder, 1-800-GOT-JUNK? & O2E Brands");
  assert.equal(linkedinAdapter.resultBelongsToHandle(res, "in/brianscudamore"), false);
  assert.equal(linkedinAdapter.resultBelongsToHandle(res, "in/scudamore"), true);
  const p = parsePublicIndexResults(linkedinAdapter, "in/scudamore", [res, r("https://brianscudamore.com/", "Brian Scudamore", "founder and serial entrepreneur")]);
  assert.equal(p.displayName, "Brian Scudamore");
  assert.equal(p.posts.length, 1);
  assert.deepEqual(p.websiteCandidates, ["https://brianscudamore.com/"]);
});

test("X is not indexed itself; the exact-URL query still yields cross-reference backlink candidates and both x.com/twitter.com phrases are tried", async () => {
  const calls: string[] = [];
  const fake: DiscoveryProvider = { id: "exa", isConfigured: () => true, healthCheck: async () => ({ available: true }), search: async (q) => { calls.push(q.query); return q.query.includes("x.com") ? [r("https://1800gotjunk.com/us_en", "Full-Service Junk Removal | 1-800-GOT-JUNK?", "call 1-800-468-5865")] : []; } };
  const out = await recoverFromPublicIndex("https://x.com/1800GOTJUNK", xAdapter, fake);
  assert.equal(out.status, "found");
  assert.ok(calls.includes('"x.com/1800gotjunk"') && calls.includes('"twitter.com/1800gotjunk"'));
  if (out.status === "found") { assert.deepEqual(out.websiteCandidates, ["https://1800gotjunk.com/us_en"]); assert.equal(out.posts.length, 0); }
});

test("source types per platform: TikTok uses the real flag; X and TikTok personal are inferred; LinkedIn by URL shape", () => {
  assert.deepEqual(classifySeedSourceType("https://www.tiktok.com/@acmehvac", "Licensed HVAC, call for a free estimate", "Acme HVAC", { business: true }), { sourceType: "TIKTOK_BUSINESS_ACCOUNT", basis: "page_text" });
  assert.equal(classifySeedSourceType("https://www.tiktok.com/@mariaflores", "Owner of Flores Cleaning", "Maria Flores", { business: false }).sourceType, "TIKTOK_CREATOR_ACCOUNT");
  assert.equal(classifySeedSourceType("https://www.tiktok.com/@mariaflores", "just vibes", "Maria Flores", { business: false }).sourceType, "TIKTOK_PERSONAL_ACCOUNT");
  assert.equal(classifySeedSourceType("https://x.com/1800GOTJUNK", "We make junk disappear.", "1-800-GOT-JUNK?", null).sourceType, "X_BUSINESS_PROFILE");
  assert.equal(classifySeedSourceType("https://x.com/johnsmith", "Founder of Smith's Auto Group", "John Smith", null).sourceType, "X_CREATOR_PROFILE");
  assert.equal(classifySeedSourceType("https://www.linkedin.com/company/1-800-got-junk/", null, null, null).sourceType, "LINKEDIN_COMPANY_PAGE");
  assert.equal(classifySeedSourceType("https://www.linkedin.com/in/scudamore", null, null, null).sourceType, "LINKEDIN_PERSON_PROFILE");
  assert.equal(classifySeedSourceType("https://www.linkedin.com/school/mit/", null, null, null).sourceType, "LINKEDIN_ORGANIZATION_PAGE");
});

function liPersonGraph(headline: string, ownerName: string | null) {
  const LI = "https://www.linkedin.com/in/scudamore", WEB = "https://www.1800gotjunk.com/";
  return {
    businessName: { value: "1-800-GOT-JUNK?", sourceUrl: WEB, sourceType: "website", strength: 3 },
    nameCandidates: [{ value: "Brian Scudamore", sourceUrl: LI, sourceType: "linkedin", strength: 2 }, { value: "1-800-GOT-JUNK?", sourceUrl: WEB, sourceType: "website", strength: 3 }],
    pageMeta: [
      { url: LI, requestedUrl: LI, sourceType: "linkedin", isSeed: true, title: "Brian Scudamore", ogTitle: "Brian Scudamore", description: headline },
      { url: WEB, requestedUrl: WEB, sourceType: "website", isSeed: false, title: "1-800-GOT-JUNK?", ogTitle: "1-800-GOT-JUNK?", description: null },
    ],
    category: "Junk Removal", description: null, services: [], ownerName,
    contactMethods: [{ type: "website", value: WEB, status: "verified", confidence: 0.9, sourceUrl: LI }, { type: "phone", value: "1-800-468-5865", status: "verified", confidence: 0.9, sourceUrl: WEB }],
    locations: [], socialProfiles: [], sourceChecks: [], qaResults: [],
    sourceLog: [
      { url: LI, sourceType: "linkedin", discoveredFrom: null, discoveryMethod: "seed", fetchStatus: "unavailable", blockedReason: "HTTP 999 — likely login-walled", primaryPassDone: false, verificationPassDone: false },
      { url: WEB, sourceType: "website", discoveredFrom: LI, discoveryMethod: "search_discovery", fetchStatus: "ok", primaryPassDone: true, verificationPassDone: true },
    ],
    signals: { hasJsonLd: false, hasHttps: true, hasMetaDescription: false, hasAggregateRating: false },
    socialRecovery: { platform: "linkedin", status: "found", handle: "in/scudamore", displayName: "Brian Scudamore", postsFound: 1, backlinkCandidates: 1, provider: "exa", reason: null },
  } as unknown as BusinessGraph;
}

test("LinkedIn personal profile, founder headline: PERSON_OPERATING_BUSINESS / FOUNDER, business name with a digit and '?' parsed, name list split on '&'", () => {
  const p = reconcileGraph(liPersonGraph("Helping entrepreneurs build exceptional brands | Founder, 1-800-GOT-JUNK? & O2E Brands | Dragon on CBC's Dragons' Den", "Brian Scudamore"), "https://www.linkedin.com/in/scudamore");
  assert.equal(p.entities.sourceType, "LINKEDIN_PERSON_PROFILE");
  assert.equal(p.entities.entityType, "PERSON_OPERATING_BUSINESS");
  assert.equal(p.entities.person?.name, "Brian Scudamore");
  assert.equal(p.entities.person?.facebookUsername, "/in/scudamore");
  assert.equal(p.entities.business?.name, "1-800-GOT-JUNK?");
  assert.equal(p.entities.relationship?.relationshipType, "FOUNDER");
  assert.equal(p.entities.relationship?.basis, "corroborated");
  assert.ok(p.limitations.some((l) => l.code === "LINKEDIN_PROFILE_LOGIN_WALLED"));
  assert.equal(saveBlockReason(p), null);
});

test("employer field never implies ownership: 'Sales Manager at 1-800-GOT-JUNK?' -> PERSON associated, EMPLOYEE/REPRESENTATIVE relationship, not operator", () => {
  const p = reconcileGraph(liPersonGraph("Sales Manager at 1-800-GOT-JUNK? | Vancouver", null), "https://www.linkedin.com/in/scudamore");
  assert.equal(p.entities.entityType, "PERSON");
  assert.equal(p.entities.businessStatus, "PERSON_ASSOCIATED_WITH_BUSINESS");
  assert.equal(p.entities.business?.name, "1-800-GOT-JUNK?");
  assert.ok(["REPRESENTATIVE", "EMPLOYEE"].includes(p.entities.relationship?.relationshipType ?? ""));
  assert.ok(p.entities.notes.some((n) => /not its operator/.test(n)));
  assert.equal(saveBlockReason(p), null);
});

// ---- regressions from the first live LinkedIn / X / TikTok runs (2026-10-05) ----
import { classifyLink } from "../../lib/research/normalize";

test("live-observed: platform CDN hosts are infrastructure, never a website (abs.twimg.com, static.licdn.com)", () => {
  assert.equal(classifyLink("https://abs.twimg.com/responsive-web/client-web/main.js").kind, "infra");
  assert.equal(classifyLink("https://static.licdn.com/aero-v1/sc/h/abc").kind, "infra");
  assert.equal(classifyLink("https://i.ytimg.com/vi/x/hqdefault.jpg").kind, "infra");
});

test("LinkedIn /in/ page that renders: og:title splits into person + headline; description becomes bio; not a business flag", () => {
  const html = '<html><head><title>Brian Scudamore - 1-800-GOT-JUNK? | LinkedIn</title><meta property="og:title" content="Brian Scudamore - 1-800-GOT-JUNK? | LinkedIn"><meta name="description" content="Brian Scudamore is the founder and CEO of O2E Brands, the banner company for… · Experience: 1-800-GOT-JUNK? · Education: Kindergarten Graduate · Location: Vancouver · 500+ connections on LinkedIn. View Brian Scudamore’s profile on LinkedIn, a professional community of 1 billion members."></head><body></body></html>';
  const ex = linkedinAdapter.extractProfile(page("https://ca.linkedin.com/in/scudamore", html, "linkedin"))!;
  assert.equal(ex.displayName, "Brian Scudamore");
  assert.equal(ex.headline, "1-800-GOT-JUNK?");
  assert.ok(ex.bio!.startsWith("Brian Scudamore is the founder and CEO of O2E Brands"));
  assert.equal(ex.location, "Vancouver");
  assert.equal(ex.flags.business, undefined);
  assert.equal(ex.urlKind, "person");
});

test("live-observed (Kalicube): a company reached through a LinkedIn profile's sidebar is NEVER the business -- no link back, no match with the headline/bio", () => {
  const LI = "https://ca.linkedin.com/in/scudamore", KAL = "https://kalicube.com/", GOT = "https://www.1800gotjunk.com/";
  const g = {
    businessName: { value: "Kalicube", sourceUrl: KAL, sourceType: "website", strength: 3 },
    nameCandidates: [
      { value: "Brian Scudamore", sourceUrl: LI, sourceType: "linkedin", strength: 2 },
      { value: "Kalicube", sourceUrl: KAL, sourceType: "website", strength: 3 },
      { value: "1-800-GOT-JUNK?", sourceUrl: GOT, sourceType: "website", strength: 3 },
      { value: "What THAT Viral Super Bowl Ad Can Teach Us About The Key To Business Success", sourceUrl: "https://www.linkedin.com/pulse/what-that-viral-super-bowl-ad-can-teach-us", sourceType: "linkedin", strength: 2 },
      { value: "Top Content on LinkedIn", sourceUrl: "https://www.linkedin.com/pulse/what-that-viral-super-bowl-ad-can-teach-us", sourceType: "linkedin", strength: 2 },
    ],
    pageMeta: [
      { url: LI, requestedUrl: "https://www.linkedin.com/in/scudamore", sourceType: "linkedin", isSeed: true, title: "Brian Scudamore - 1-800-GOT-JUNK? | LinkedIn", ogTitle: "Brian Scudamore", headline: "1-800-GOT-JUNK?", description: "1-800-GOT-JUNK? | Brian Scudamore is the founder and CEO of O2E Brands, the banner company for 1-800-GOT-JUNK?" },
      { url: KAL, requestedUrl: KAL, sourceType: "website", isSeed: false, trusted: false, title: "Kalicube", ogTitle: "Kalicube", description: "Services de marketing" },
      { url: GOT, requestedUrl: GOT, sourceType: "website", isSeed: false, trusted: false, title: "1-800-GOT-JUNK?", ogTitle: "1-800-GOT-JUNK?", description: null },
      { url: "https://www.linkedin.com/pulse/what-that-viral-super-bowl-ad-can-teach-us", requestedUrl: "https://www.linkedin.com/pulse/x", sourceType: "linkedin", isSeed: false, trusted: false, title: null, ogTitle: null, description: null },
    ],
    category: null, description: null, services: [], ownerName: null,
    contactMethods: [{ type: "website", value: KAL, status: "uncertain", confidence: 0.4, sourceUrl: LI }],
    locations: [{ name: null, address: null, city: "Aubais", state: "Gard", postalCode: null, locationType: "primary", status: "verified", confidence: 0.7, sourceUrl: KAL }],
    socialProfiles: [], sourceChecks: [], qaResults: [],
    sourceLog: [
      { url: LI, sourceType: "linkedin", discoveredFrom: null, discoveryMethod: "seed", fetchStatus: "ok", primaryPassDone: true, verificationPassDone: true },
      { url: KAL, sourceType: "website", discoveredFrom: LI, discoveryMethod: "link_extraction", fetchStatus: "ok", primaryPassDone: true, verificationPassDone: true },
      { url: GOT, sourceType: "website", discoveredFrom: LI, discoveryMethod: "search_discovery", fetchStatus: "ok", primaryPassDone: true, verificationPassDone: true },
    ],
    signals: { hasJsonLd: true, hasHttps: true, hasMetaDescription: true, hasAggregateRating: false },
  } as unknown as BusinessGraph;
  const p = reconcileGraph(g, "https://www.linkedin.com/in/scudamore");
  assert.notEqual(p.entities.business?.name, "Kalicube");
  assert.equal(p.entities.business?.name, "1-800-GOT-JUNK?"); // matches the headline the account itself publishes
  assert.equal(p.entities.person?.name, "Brian Scudamore");
  assert.equal(p.entities.entityType, "PERSON_OPERATING_BUSINESS");
  assert.ok(["FOUNDER", "CEO"].includes(p.entities.relationship?.relationshipType ?? ""));
  assert.equal(p.locations.physical.length, 0); // Aubais/Gard came from the untrusted Kalicube page -- never attached
  assert.ok(!p.entities.business!.candidates.some((c) => /Viral Super Bowl|Top Content/.test(c.value))); // article titles are not name possibilities
  assert.equal(saveBlockReason(p), null);
});
test("website deep path on the confirmed official domain collapses to the site section root", () => {
  const X = "https://x.com/1800GOTJUNK", GOT = "https://www.1800gotjunk.com/us_en/blog/decluttering/questions-you-should-ask-before-pickup-day";
  const g = {
    businessName: { value: "1-800-GOT-JUNK?", sourceUrl: GOT, sourceType: "website", strength: 3 },
    nameCandidates: [{ value: "1-800-GOT-JUNK?", sourceUrl: X, sourceType: "x", strength: 3 }, { value: "1-800-GOT-JUNK?", sourceUrl: GOT, sourceType: "website", strength: 3 }],
    pageMeta: [{ url: X, requestedUrl: X, sourceType: "x", isSeed: true, trusted: true, title: null, ogTitle: "1-800-GOT-JUNK?", description: "We make junk disappear.", accountFlags: {} }, { url: GOT, requestedUrl: GOT, sourceType: "website", isSeed: false, trusted: true, linksToSeed: true, title: null, ogTitle: null, description: null }],
    category: null, description: null, services: [], ownerName: null,
    contactMethods: [{ type: "website", value: GOT, status: "verified", confidence: 0.9, sourceUrl: X }],
    locations: [], socialProfiles: [], sourceChecks: [], qaResults: [],
    sourceLog: [{ url: X, sourceType: "x", discoveredFrom: null, discoveryMethod: "seed", fetchStatus: "ok", primaryPassDone: true, verificationPassDone: true }, { url: GOT, sourceType: "website", discoveredFrom: X, discoveryMethod: "search_discovery", fetchStatus: "ok", primaryPassDone: true, verificationPassDone: true }],
    signals: { hasJsonLd: true, hasHttps: true, hasMetaDescription: true, hasAggregateRating: false },
  } as unknown as BusinessGraph;
  const p = reconcileGraph(g, X);
  assert.equal(p.website.value, "https://www.1800gotjunk.com/us_en");
  assert.equal(p.website.status, "CONFIRMED");
});

test("live-observed: a page title like 'Manage Your Appointments' is never a business-name candidate", () => {
  const X = "https://x.com/1800GOTJUNK", GOT = "https://www.1800gotjunk.com/";
  const g = {
    businessName: { value: "1-800-GOT-JUNK?", sourceUrl: GOT, sourceType: "website", strength: 3 },
    nameCandidates: [{ value: "1-800-GOT-JUNK?", sourceUrl: X, sourceType: "x", strength: 3 }, { value: "1-800-GOT-JUNK?", sourceUrl: GOT, sourceType: "website", strength: 3 }, { value: "Manage Your Appointments", sourceUrl: GOT + "us_en/manage", sourceType: "website", strength: 2 }],
    pageMeta: [{ url: X, requestedUrl: X, sourceType: "x", isSeed: true, title: "1-800-GOT-JUNK? (@1800GOTJUNK) / X", ogTitle: "1-800-GOT-JUNK?", description: "We make junk disappear. All you have to do is point!", accountFlags: {} }, { url: GOT, requestedUrl: GOT, sourceType: "website", isSeed: false, linksToSeed: true, title: null, ogTitle: null, description: null }],
    category: null, description: null, services: [], ownerName: null,
    contactMethods: [{ type: "website", value: GOT, status: "verified", confidence: 0.9, sourceUrl: X }, { type: "phone", value: "1-800-468-5865", status: "verified", confidence: 0.9, sourceUrl: GOT }],
    locations: [], socialProfiles: [], sourceChecks: [], qaResults: [],
    sourceLog: [{ url: X, sourceType: "x", discoveredFrom: null, discoveryMethod: "seed", fetchStatus: "ok", primaryPassDone: true, verificationPassDone: true }, { url: GOT, sourceType: "website", discoveredFrom: X, discoveryMethod: "search_discovery", fetchStatus: "ok", primaryPassDone: true, verificationPassDone: true }],
    signals: { hasJsonLd: true, hasHttps: true, hasMetaDescription: true, hasAggregateRating: false },
  } as unknown as BusinessGraph;
  const p = reconcileGraph(g, X);
  assert.equal(p.entities.sourceType, "X_BUSINESS_PROFILE");
  assert.deepEqual(p.entities.business?.candidates.map((c) => c.value), ["1-800-GOT-JUNK?"]);
  assert.equal(p.identity.identityConfidence, "confirmed");
});
