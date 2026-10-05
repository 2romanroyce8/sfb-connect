import { test } from "node:test";
import assert from "node:assert/strict";
import { reconcileGraph, saveBlockReason, detectFacebookProfileType, normalizePhoneE164, normalizeBusinessName, classifyLinkType } from "../../lib/research/reconcile";
import { detectScope, resolveEngineScope } from "../../lib/research/scopeDetection";
import type { BusinessGraph } from "../../lib/research/types";

const FB = "https://www.facebook.com/supremeairnj";
const SITE = "https://supreme-air.com";

function graph(over: Partial<BusinessGraph> = {}): BusinessGraph {
  return {
    businessName: { value: "Supreme Air LLC", sourceUrl: FB, sourceType: "facebook", strength: 3 },
    category: "HVAC Contractor",
    description: "Residential and commercial HVAC in NJ.",
    services: ["AC repair", "Furnace installation"],
    ownerName: null,
    contactMethods: [
      { type: "phone", value: "(732) 213-0373", status: "verified", confidence: 0.9, sourceUrl: FB },
      { type: "phone", value: "732-213-0373", status: "verified", confidence: 0.9, sourceUrl: SITE },
      { type: "website", value: SITE, status: "verified", confidence: 0.9, sourceUrl: FB },
      { type: "email", value: "hello@supreme-air.com", status: "verified", confidence: 0.8, sourceUrl: SITE },
    ],
    locations: [
      { name: null, address: null, city: "Edison", state: "NJ", postalCode: null, locationType: "primary", status: "verified", confidence: 0.8, sourceUrl: SITE },
      { name: null, address: null, city: "Woodbridge", state: "NJ", postalCode: null, locationType: "service_area", status: "verified", confidence: 0.7, sourceUrl: SITE },
    ],
    socialProfiles: [{ platform: "instagram", handle: "supremeairnj", url: "https://instagram.com/supremeairnj", displayName: null, status: "verified", confidence: 0.8, sourceUrl: SITE }],
    sourceChecks: [],
    sourceLog: [
      { url: FB, sourceType: "facebook", discoveredFrom: null, discoveryMethod: "seed", fetchStatus: "ok", primaryPassDone: true, verificationPassDone: true },
      { url: SITE, sourceType: "website", discoveredFrom: FB, discoveryMethod: "link_extraction", fetchStatus: "ok", primaryPassDone: true, verificationPassDone: true },
      { url: "https://instagram.com/supremeairnj", sourceType: "instagram", discoveredFrom: SITE, discoveryMethod: "social_link", fetchStatus: "unavailable", blockedReason: "login wall", primaryPassDone: false, verificationPassDone: false },
      { url: "https://www.yelp.com/biz/supreme-air", sourceType: "yelp", discoveredFrom: SITE, discoveryMethod: "link_extraction", fetchStatus: "ok", primaryPassDone: true, verificationPassDone: false },
      { url: "https://example.com/article?utm_source=fb", sourceType: "other", discoveredFrom: FB, discoveryMethod: "link_extraction", fetchStatus: "ok", primaryPassDone: false, verificationPassDone: false },
    ],
    qaResults: [],
    signals: { hasJsonLd: true, hasHttps: true, hasMetaDescription: true, hasAggregateRating: false },
    ...over,
  } as BusinessGraph;
}

// ---- scope detection (§1) ----
test("scope: facebook/instagram/maps/linktree/website detected", () => {
  assert.equal(detectScope("https://www.facebook.com/profile.php?id=123"), "SOCIAL_PROFILE");
  assert.equal(detectScope("https://instagram.com/x"), "SOCIAL_PROFILE");
  assert.equal(detectScope("https://maps.google.com/?cid=1"), "GOOGLE_BUSINESS");
  assert.equal(detectScope("https://g.page/some-biz"), "GOOGLE_BUSINESS");
  assert.equal(detectScope("https://linktr.ee/biz"), "BIO_LINK_HUB");
  assert.equal(detectScope("https://supreme-air.com"), "WEBSITE");
});
test("scope: QUICK override wins; social -> social_profile engine mode", () => {
  assert.equal(resolveEngineScope("SOCIAL_PROFILE", "QUICK"), "quick_contact");
  assert.equal(resolveEngineScope("SOCIAL_PROFILE", "AUTO"), "social_profile");
  assert.equal(resolveEngineScope("WEBSITE", "DEEP"), "public_web");
});

// ---- normalization ----
test("phone normalization to E.164; same number in two formats collapses", () => {
  assert.equal(normalizePhoneE164("(732) 213-0373"), "+17322130373");
  assert.equal(normalizePhoneE164("732-213-0373"), "+17322130373");
  assert.equal(normalizePhoneE164("1-732-213-0373"), "+17322130373");
  assert.equal(normalizePhoneE164("abc"), null);
});
test("business name normalization strips LLC/Inc/The", () => {
  assert.equal(normalizeBusinessName("Supreme Air LLC"), normalizeBusinessName("The Supreme Air, Inc."));
});

// ---- profile type (§3) ----
test("facebook profile type: pages -> BUSINESS_PAGE, numeric id personal name -> PERSONAL_PROFILE, trade name -> PUBLIC_PROFILE", () => {
  assert.equal(detectFacebookProfileType("https://facebook.com/pages/Acme/123", "Acme"), "BUSINESS_PAGE");
  assert.equal(detectFacebookProfileType("https://facebook.com/profile.php?id=100012345", "Wayne D."), "PERSONAL_PROFILE");
  assert.equal(detectFacebookProfileType("https://facebook.com/profile.php?id=100012345", "Wayne's Junk Removal"), "PUBLIC_PROFILE");
  assert.equal(detectFacebookProfileType("https://facebook.com/groups/njhvac", "NJ HVAC"), "GROUP");
  assert.equal(detectFacebookProfileType("https://facebook.com/supremeairnj", "Supreme Air LLC"), "BUSINESS_PAGE");
});

// ---- social path shape (observed live: platform chrome misclassified as first-party) ----
test("social URLs are first-party only when profile-shaped; platform navigation is P0", () => {
  assert.equal(classifyLinkType("https://www.youtube.com/@JunkSeekers", false).priority, 1);
  assert.equal(classifyLinkType("https://www.instagram.com/sdjunkseekers/", false).priority, 1);
  assert.equal(classifyLinkType("https://www.facebook.com/sandiegojunkseekers", false).priority, 1);
  assert.equal(classifyLinkType("https://www.facebook.com/profile.php?id=61593970382006", false).priority, 1);
  for (const noise of [
    "https://www.youtube.com/t/contact_us/",
    "https://www.youtube.com/creators/",
    "https://www.youtube.com/new",
    "https://www.youtube.com/",
    "https://www.youtube.com/manifest.webmanifest",
    "https://www.youtube.com/opensearch?locale=en_US",
    "https://www.youtube.com/s/desktop/50ec8f0a/img/favicon.ico",
    "https://tv.youtube.com/learn/nflsundayticket",
    "https://www.facebook.com/data/manifest/?is_workplace_mobile_pwa_dogfooding=0",
    "https://www.facebook.com/login/",
    "https://www.instagram.com/explore/",
  ]) {
    assert.equal(classifyLinkType(noise, false).priority, 0, noise);
  }
});
test("a platform's own account (x.com/YouTube picked up from YouTube chrome) is rejected, never attributed to the business", () => {
  const g = graph();
  g.socialProfiles.push({ platform: "x", handle: "YouTube", url: "https://x.com/YouTube", displayName: null, status: "verified", confidence: 0.6, sourceUrl: "https://www.youtube.com/@JunkSeekers" } as any);
  const p = reconcileGraph(g, FB);
  const x = p.socialProfiles.find((s) => s.platform === "x")!;
  assert.equal(x.association, "rejected_unrelated");
  assert.equal(x.status, "not_found");
  assert.ok(!p.salesIntelligence.howTheySell.includes("X"));
});
test("vanity facebook URL with a two-word business name is a BUSINESS_PAGE, not a personal profile", () => {
  assert.equal(detectFacebookProfileType("https://www.facebook.com/sandiegojunkseekers", "Junk Seekers"), "BUSINESS_PAGE");
});

// ---- link priority (§4) ----
test("link priority: social=1, yelp=2, tracking=0, unknown other=3, official domain=1", () => {
  assert.deepEqual(classifyLinkType("https://instagram.com/x", false).priority, 1);
  assert.deepEqual(classifyLinkType("https://www.yelp.com/biz/x", false).priority, 2);
  assert.deepEqual(classifyLinkType("https://x.com/share?utm_source=a", false).priority, 0);
  assert.deepEqual(classifyLinkType("https://news.example.com/story", false).priority, 3);
  assert.deepEqual(classifyLinkType("https://supreme-air.com/about", true), { linkType: "official_website", priority: 1 });
});

// ---- full reconciliation (§6) ----
test("reconcile: same phone in two formats across FB + site -> ONE CONFIRMED HIGH phone, no conflict", () => {
  const p = reconcileGraph(graph(), FB);
  assert.equal(p.contacts.phones.length, 1);
  assert.equal(p.contacts.phones[0].normalized, "+17322130373");
  assert.equal(p.contacts.phones[0].status, "CONFIRMED");
  assert.equal(p.contacts.phones[0].confidence, "HIGH");
  assert.equal(p.contacts.phones[0].sources.length, 2);
  assert.equal(p.conflicts.length, 0);
});
test("reconcile: identity CONFIRMED when strong name + confirmed website; research status reflects login-walled source as a limitation", () => {
  const p = reconcileGraph(graph(), FB);
  assert.equal(p.identity.identityConfidence, "confirmed");
  assert.equal(p.identity.profileType, "BUSINESS_PAGE");
  assert.equal(p.metrics.researchStatus, "completed_with_limitations"); // instagram login wall
  assert.ok(p.limitations.some((l) => l.code === "SOURCES_INACCESSIBLE"));
  assert.equal(saveBlockReason(p), null);
});
test("reconcile: two DIFFERENT first-party phones -> CONFLICT surfaced, both kept with sources, never silently picked", () => {
  const g = graph();
  g.contactMethods.push({ type: "phone", value: "732-999-9999", status: "verified", confidence: 0.9, sourceUrl: SITE });
  const p = reconcileGraph(g, FB);
  assert.equal(p.conflicts.length, 1);
  assert.equal(p.conflicts[0].field, "phone");
  assert.equal(p.conflicts[0].values.length, 2);
  assert.ok(p.contacts.phones.every((x) => x.status === "CONFLICT"));
  assert.ok(p.salesIntelligence.onlineWeaknesses.some((w) => /phone differs/i.test(w)));
});
test("reconcile: physical vs service-area never merged", () => {
  const p = reconcileGraph(graph(), FB);
  assert.equal(p.locations.physical[0].city, "Edison");
  assert.equal(p.locations.serviceArea[0].city, "Woodbridge");
});
test("reconcile: source entities classified -- seed+site first-party, yelp priority 2, utm link ignored, IG login-walled", () => {
  const p = reconcileGraph(graph(), FB);
  const byUrl = Object.fromEntries(p.sources.map((s) => [s.url, s]));
  assert.equal(byUrl[FB].association, "confirmed_first_party");
  assert.equal(byUrl[SITE].association, "confirmed_first_party");
  assert.equal(byUrl["https://www.yelp.com/biz/supreme-air"].priority, 2);
  assert.equal(byUrl["https://example.com/article?utm_source=fb"].priority, 0);
  assert.equal(byUrl["https://instagram.com/supremeairnj"].fetchStatus, "blocked_login_wall");
  assert.equal(p.metrics.sourcesChecked, 5);
  assert.equal(p.metrics.sourcesFetched, 3);
});
test("reconcile: no pricing evidence -> explicit NO_PUBLIC_PRICING_FOUND weakness, never an invented price", () => {
  const p = reconcileGraph(graph(), FB);
  assert.equal(p.business.pricing.note, "NO_PUBLIC_PRICING_FOUND");
  assert.ok(p.salesIntelligence.onlineWeaknesses.includes("No public pricing found"));
});

// ---- identity gate (§3 hard rule) ----
test("identity gate: personal profile with weak name and no phone/site -> UNCERTAIN and Save blocked", () => {
  const g = graph({
    businessName: { value: "Wayne D.", sourceUrl: "https://facebook.com/profile.php?id=100099", sourceType: "facebook", strength: 1 },
    contactMethods: [],
    locations: [],
    socialProfiles: [],
    sourceLog: [{ url: "https://facebook.com/profile.php?id=100099", sourceType: "facebook", discoveredFrom: null, discoveryMethod: "seed", fetchStatus: "ok", primaryPassDone: true, verificationPassDone: true }],
  });
  const p = reconcileGraph(g, "https://facebook.com/profile.php?id=100099");
  assert.equal(p.identity.profileType, "PERSONAL_PROFILE");
  assert.equal(p.identity.identityConfidence, "uncertain");
  assert.ok(saveBlockReason(p));
  assert.ok(p.salesIntelligence.callPrep[0].includes("Identity is not fully confirmed"));
});
test("identity gate: name-only match (World Bank Group class) with different-domain site stays UNCERTAIN", () => {
  const g = graph({
    businessName: { value: "World Bank Group", sourceUrl: "https://facebook.com/arturo", sourceType: "facebook", strength: 1 },
    contactMethods: [{ type: "website", value: "https://arturoherrera.dev/", status: "uncertain", confidence: 0.3, sourceUrl: "https://facebook.com/arturo" }],
    sourceLog: [{ url: "https://facebook.com/arturo", sourceType: "facebook", discoveredFrom: null, discoveryMethod: "seed", fetchStatus: "ok", primaryPassDone: true, verificationPassDone: true }],
    locations: [],
    socialProfiles: [],
  });
  const p = reconcileGraph(g, "https://facebook.com/arturo");
  assert.notEqual(p.identity.identityConfidence, "confirmed");
  assert.equal(p.website.status, "UNCERTAIN");
});
test("research confidence %: full graph scores high; empty graph scores 0 with NOT_FOUND identity", () => {
  assert.ok(reconcileGraph(graph(), FB).metrics.researchConfidencePct >= 85);
  const empty = reconcileGraph(graph({ businessName: null, contactMethods: [], locations: [], socialProfiles: [], services: [], category: null, sourceLog: [] }), FB);
  assert.equal(empty.metrics.researchConfidencePct, 0);
  assert.equal(empty.identity.identityConfidence, "not_found");
  assert.ok(saveBlockReason(empty));
});
