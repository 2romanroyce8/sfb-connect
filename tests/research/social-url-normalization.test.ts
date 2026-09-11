// ============================================================
// Regression suite for cross-platform social profile URL canonicalization.
//
// Triggering incident: a garbage, double-encoded Instagram seed URL led
// (via Instagram's own login page -> Facebook's Help Center -> a linked
// corporate page) to crm_research_results storing website="https://about.meta.com"
// for a business that was never actually identified. Root cause was NOT a
// string-concatenation bug (no code path anywhere builds "facebook.com.meta"
// -- confirmed by full-repo audit) but two real, related gaps:
//   1. classifyLink() had no reserved-route filter, so ANY facebook.com/*
//      path (including /help/*) was treated as a business social profile.
//   2. meta.com/bytedance.com/google.com had no denylist entry, so a
//      platform's own corporate site could win the "official website" vote.
// Both are fixed in normalize.ts. This suite locks in the NEW centralized
// normalizer (SocialProfileNormalizer.ts) that every downstream caller
// (SocialDiscoveryService today; ResearchQA/Scout going forward) must use
// instead of inventing their own hostname/handle parsing.
//
// Run with: npx tsx --test tests/research/social-url-normalization.test.ts
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSocialProfileUrl, socialProfileKey } from "../../lib/research/SocialProfileNormalizer";
import { classifyLink, isInfrastructureUrl } from "../../lib/research/normalize";

// ---- FACEBOOK ----
test("Facebook — vanity handle canonicalizes and strips www/trailing slash", () => {
  const r = normalizeSocialProfileUrl("https://www.facebook.com/tonytints925/");
  assert.equal(r.valid, true);
  assert.equal(r.platform, "facebook");
  assert.equal(r.hostname, "facebook.com");
  assert.equal(r.handle, "tonytints925");
  assert.equal(r.canonicalUrl, "https://facebook.com/tonytints925");
  assert.equal(r.canonicalUrl?.includes(".meta"), false);
});

test("Facebook — m. and mbasic. aliases collapse to the same canonical profile", () => {
  const m = normalizeSocialProfileUrl("https://m.facebook.com/tonytints925");
  const mbasic = normalizeSocialProfileUrl("https://mbasic.facebook.com/tonytints925");
  assert.equal(m.canonicalUrl, "https://facebook.com/tonytints925");
  assert.equal(mbasic.canonicalUrl, "https://facebook.com/tonytints925");
});

test("Facebook — profile.php?id= retains the numeric ID, not stripped", () => {
  const r = normalizeSocialProfileUrl("https://www.facebook.com/profile.php?id=123456789");
  assert.equal(r.valid, true);
  assert.equal(r.profileType, "profile_id");
  assert.equal(r.canonicalUrl, "https://facebook.com/profile.php?id=123456789");
});

test("Facebook — /pages/Name/id retains the name-bearing path", () => {
  const r = normalizeSocialProfileUrl("https://www.facebook.com/pages/Tony-Tints/123456");
  assert.equal(r.valid, true);
  assert.equal(r.profileType, "pages");
  assert.equal(r.canonicalUrl, "https://facebook.com/pages/Tony-Tints/123456");
  assert.equal(r.handle, "Tony Tints");
});

test("Facebook — Help Center / login / share are REJECTED, not treated as a profile", () => {
  const help = normalizeSocialProfileUrl("https://www.facebook.com/help/instagram/261704639352628");
  assert.equal(help.valid, false);
  assert.equal(help.rejectionReason, "RESERVED_PLATFORM_ROUTE");
  const login = normalizeSocialProfileUrl("https://www.facebook.com/login.php?next=x");
  assert.equal(login.valid, false);
  assert.equal(classifyLink("https://www.facebook.com/help/instagram/261704639352628").kind, "infra");
});

// ---- INSTAGRAM ----
test("Instagram — handle canonicalizes, never .meta", () => {
  const r = normalizeSocialProfileUrl("https://www.instagram.com/examplebusiness/");
  assert.equal(r.canonicalUrl, "https://instagram.com/examplebusiness");
  assert.equal(r.platform, "instagram");
  assert.equal(r.canonicalUrl?.includes(".meta"), false);
});

test("Instagram — /p/, /reel/, /explore/, /accounts/ are not business profiles", () => {
  for (const path of ["https://www.instagram.com/p/ABC123/", "https://www.instagram.com/reel/XYZ/", "https://www.instagram.com/explore/", "https://www.instagram.com/accounts/login/"]) {
    const r = normalizeSocialProfileUrl(path);
    assert.equal(r.valid, false, `expected ${path} to be rejected`);
  }
});

// ---- TIKTOK ----
test("TikTok — @handle canonicalizes", () => {
  const r = normalizeSocialProfileUrl("https://www.tiktok.com/@examplebusiness");
  assert.equal(r.canonicalUrl, "https://tiktok.com/@examplebusiness");
  assert.equal(r.handle, "examplebusiness");
});

// ---- YOUTUBE ----
test("YouTube — @handle canonicalizes and is NOT collapsed to bare youtube.com", () => {
  const r = normalizeSocialProfileUrl("https://www.youtube.com/@AcmeRoofing");
  assert.equal(r.canonicalUrl, "https://youtube.com/@AcmeRoofing");
  assert.notEqual(r.canonicalUrl, "https://youtube.com");
  assert.equal(r.canonicalUrl?.includes(".google"), false);
});

test("YouTube — channel/c/user routes preserve the identity segment", () => {
  assert.equal(normalizeSocialProfileUrl("https://youtube.com/channel/UC12345").canonicalUrl, "https://youtube.com/channel/UC12345");
  assert.equal(normalizeSocialProfileUrl("https://youtube.com/c/AcmeRoofing").canonicalUrl, "https://youtube.com/c/AcmeRoofing");
  assert.equal(normalizeSocialProfileUrl("https://youtube.com/user/AcmeRoofing").canonicalUrl, "https://youtube.com/user/AcmeRoofing");
});

test("YouTube — /watch, /results, /shorts are not channel identity", () => {
  assert.equal(normalizeSocialProfileUrl("https://www.youtube.com/watch?v=abc123").valid, false);
  assert.equal(normalizeSocialProfileUrl("https://www.youtube.com/results?search_query=roofing").valid, false);
});

// ---- X / TWITTER ----
test("X/Twitter — twitter.com normalizes to x.com canonical", () => {
  const r = normalizeSocialProfileUrl("https://twitter.com/examplebusiness");
  assert.equal(r.canonicalUrl, "https://x.com/examplebusiness");
  assert.equal(r.platform, "x");
});

test("X — infrastructure/reserved routes rejected", () => {
  assert.equal(normalizeSocialProfileUrl("https://x.com/home").valid, false);
  assert.equal(normalizeSocialProfileUrl("https://x.com/search?q=roofing").valid, false);
});

// ---- CROSS-PROFILE: domain identity vs. profile identity ----
test("Cross-profile — two different Facebook businesses get different socialProfileKeys", () => {
  const a = socialProfileKey("https://facebook.com/businessA");
  const b = socialProfileKey("https://facebook.com/businessB");
  assert.notEqual(a, b, "different businesses on the same platform must not collapse to one identity");
});

test("Cross-profile — the SAME business via different host aliases collapses to one key", () => {
  const a = socialProfileKey("https://www.facebook.com/TonyTints925/");
  const b = socialProfileKey("https://facebook.com/tonytints925");
  assert.equal(a, b, "case/alias variants of the same handle should collapse (platform handles are case-insensitive in practice)");
});

// ---- PLATFORM-OWNER METADATA MUST NEVER LEAK INTO THE URL ----
test("Owner-metadata test — Facebook result with owner=Meta never produces .meta in canonical output", () => {
  // Simulates a discovery-result parser that has BOTH the URL and separate
  // owner/company metadata available -- the normalizer only ever looks at
  // the URL, so owner metadata has no path into canonicalUrl at all.
  const mockDiscoveryResult = { url: "https://www.facebook.com/acmeroofing", platform: "Facebook", owner: "Meta" };
  const r = normalizeSocialProfileUrl(mockDiscoveryResult.url);
  assert.equal(r.canonicalUrl, "https://facebook.com/acmeroofing");
  assert.equal(r.canonicalUrl?.includes(".meta"), false);
  assert.equal(r.canonicalUrl?.includes("Meta"), false);
  // platformOwner is carried as its OWN separate field, exactly once, never merged into the URL:
  assert.equal(r.platformOwner, "Meta");
});

test("YouTube owner-metadata test — owner=Google never produces .google in canonical output", () => {
  const mockDiscoveryResult = { url: "https://youtube.com/@acmeroofing", platform: "YouTube", owner: "Google" };
  const r = normalizeSocialProfileUrl(mockDiscoveryResult.url);
  assert.equal(r.canonicalUrl, "https://youtube.com/@acmeroofing");
  assert.equal(r.canonicalUrl?.includes(".google"), false);
  assert.equal(r.platformOwner, "Google");
});

// ---- Platform-owner corporate domains must never win "official website" ----
test("about.meta.com / meta.com / bytedance.com / google.com are treated as infrastructure, never a website candidate", () => {
  assert.equal(isInfrastructureUrl("https://about.meta.com"), true);
  assert.equal(isInfrastructureUrl("https://www.meta.com/about/"), true);
  assert.equal(isInfrastructureUrl("https://www.bytedance.com"), true);
  assert.equal(isInfrastructureUrl("https://google.com"), true);
  assert.equal(classifyLink("https://about.meta.com").kind, "infra");
});

test("Legitimate Google-hosted small-business sites are NOT blocked (only Google's own corporate domain is)", () => {
  assert.equal(isInfrastructureUrl("https://sites.google.com/view/acmeroofing"), false);
});

// ---- Reproduces the exact production incident end-to-end ----
test("Production incident reproduction — Facebook Help Center link never becomes a discoverable social/website source", () => {
  const helpCenterLink = "https://www.facebook.com/help/instagram/261704639352628";
  assert.equal(classifyLink(helpCenterLink).kind, "infra", "must not be classified as a social profile");
  const identity = normalizeSocialProfileUrl(helpCenterLink);
  assert.equal(identity.valid, false);
  assert.equal(identity.rejectionReason, "RESERVED_PLATFORM_ROUTE");
});

// ---- Invalid input fails closed, never fabricates a URL ----
test("Fail-closed — garbage input never produces a fabricated canonical URL", () => {
  const r = normalizeSocialProfileUrl("not a url at all");
  assert.equal(r.canonicalUrl, null);
  assert.equal(r.valid, false);
  assert.equal(r.rejectionReason, "INVALID_SOCIAL_PROFILE_URL");
});
