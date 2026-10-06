import { test } from "node:test";
import assert from "node:assert/strict";
import { instagramHandleFromUrl, parseInstagramIndexResults, resultBelongsToHandle, recoverInstagramFromPublicIndex } from "../../lib/research/InstagramRecovery";
import type { DiscoveryResult, DiscoveryProvider } from "../../lib/research/providers/types";
import { reconcileGraph, saveBlockReason } from "../../lib/research/reconcile";
import type { BusinessGraph } from "../../lib/research/types";

const now = new Date().toISOString();
const r = (url: string, title: string | null, description: string | null): DiscoveryResult => ({ url, title, description, provider: "exa", rank: 1, discoveredAt: now });

// Real shapes observed from the public index on 2026-10-05 for instagram.com/sdjunkseekers
const POST = r("https://www.instagram.com/p/DH127sRSZ1h/", 'junkseekers on Instagram: "Just wrapped up a quick and efficient junk removal job in Chula Vista, CA! Need junk removed? Call Junk Seekers at 619-916-8419 and let’s clear it out!"', "Instagram • Follow --- Just wrapped up ... Call Junk Seekers at 619-916-8419 ... Like Reply 5 1 Log in to like or comment. --- More posts from sdjunkseekers ---");
const OTHER_POST = r("https://www.instagram.com/p/DGZAFd5zZw8/", 'Junk Away - San Diego on Instagram: "San Diego Premier Junk Removal same day service!"', "Junk Away - San Diego | ... | Instagram");
const OTHER_HANDLE_POST = r("https://www.instagram.com/junk_hunters/p/DHtsHLES263/", 'Junk-Hunters.com on Instagram: "Donation Pickup"', null);
const SITE = r("https://junkseekers.com/", "San Diego's Trusted Hauling & Junk Removal | Junk Seekers", "At Junk Seekers, we take pride...");
const DIR = r("https://sandiegomoms.com/directory/listing/85217/", "Junk Seekers", "Junk Seekers is a trusted junk removal service...");

test("instagram handle from URL; reserved routes and post URLs are not handles", () => {
  assert.equal(instagramHandleFromUrl("https://www.instagram.com/sdjunkseekers/"), "sdjunkseekers");
  assert.equal(instagramHandleFromUrl("instagram.com/@SDJunkSeekers"), "sdjunkseekers");
  assert.equal(instagramHandleFromUrl("https://www.instagram.com/p/DH127sRSZ1h/"), null);
  assert.equal(instagramHandleFromUrl("https://www.instagram.com/explore/"), null);
  assert.equal(instagramHandleFromUrl("https://facebook.com/x"), null);
});

test("exact-handle attribution: 'More posts from <handle>' and /<handle>/ paths belong; similar-looking accounts never do", () => {
  assert.ok(resultBelongsToHandle(POST, "sdjunkseekers"));
  assert.ok(!resultBelongsToHandle(OTHER_POST, "sdjunkseekers")); // Junk Away -- similar business, different account
  assert.ok(!resultBelongsToHandle(OTHER_HANDLE_POST, "sdjunkseekers"));
  assert.ok(resultBelongsToHandle(OTHER_HANDLE_POST, "junk_hunters"));
});

test("parse: display name, caption, phone, website + directory candidates; unrelated accounts dropped", () => {
  const p = parseInstagramIndexResults("sdjunkseekers", [SITE, POST, OTHER_POST, OTHER_HANDLE_POST, DIR]);
  assert.equal(p.displayName, "junkseekers");
  assert.equal(p.posts.length, 1);
  assert.deepEqual(p.phones, ["619-916-8419"]);
  // sandiegomoms.com is not a known directory host, so it is a website
  // CANDIDATE -- the discovery graph fetches and verifies it like any other
  // source; nothing is attached on the strength of a search result alone.
  assert.deepEqual(p.websiteCandidates, ["https://junkseekers.com/", "https://sandiegomoms.com/directory/listing/85217/"]);
  assert.deepEqual(p.directoryCandidates, []);
  assert.ok(p.captionText.includes("Call Junk Seekers"));
  assert.ok(!p.captionText.includes("More posts from"));
});

test("recovery: query 1 is the exact profile URL phrase; query 2 (handle on instagram.com) only when no posts surfaced; unavailable without a provider", async () => {
  const calls: { query: string; domains?: string[] }[] = [];
  const fake = (results: DiscoveryResult[][]): DiscoveryProvider => ({ id: "exa", isConfigured: () => true, healthCheck: async () => ({ available: true }), search: async (q) => { calls.push({ query: q.query, domains: q.domains }); return results.shift() ?? []; } });
  const a = await recoverInstagramFromPublicIndex("https://www.instagram.com/sdjunkseekers/", fake([[SITE, POST]]));
  assert.equal(a.status, "found");
  assert.deepEqual(calls.map((c) => c.query), ['"instagram.com/sdjunkseekers"']);
  calls.length = 0;
  const b = await recoverInstagramFromPublicIndex("https://www.instagram.com/nobodyhere123/", fake([[], []]));
  assert.equal(b.status, "not_found");
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1].domains, ["instagram.com"]);
  const c = await recoverInstagramFromPublicIndex("https://www.instagram.com/sdjunkseekers/", null);
  assert.equal(c.status, "unavailable");
});

test("reconcile: instagram seed recovered from public index -> BUSINESS, website that links back to @handle is cross-link CONFIRMED, indexed posts are first-party evidence", () => {
  const IG = "https://www.instagram.com/sdjunkseekers/", WEB = "https://junkseekers.com/", POSTURL = "https://www.instagram.com/p/DH127sRSZ1h/";
  const g: BusinessGraph = {
    businessName: { value: "Junk Seekers", sourceUrl: WEB, sourceType: "website", strength: 3 },
    nameCandidates: [{ value: "junkseekers", sourceUrl: IG, sourceType: "instagram", strength: 2 }, { value: "Junk Seekers", sourceUrl: WEB, sourceType: "website", strength: 3 }],
    pageMeta: [
      { url: IG, requestedUrl: IG, sourceType: "instagram", isSeed: true, title: "junkseekers", ogTitle: "junkseekers", description: "Just wrapped up a quick and efficient junk removal job in Chula Vista, CA! Need junk removed? Call Junk Seekers at 619-916-8419" },
      { url: POSTURL, requestedUrl: POSTURL, sourceType: "instagram", isSeed: false, sameAccountAsSeed: true, title: null, ogTitle: "junkseekers", description: "Call Junk Seekers at 619-916-8419" },
      { url: WEB, requestedUrl: WEB, sourceType: "website", isSeed: false, linksToSeed: true, title: "Junk Seekers", ogTitle: "Junk Seekers", description: "San Diego junk removal" },
    ],
    category: "Junk Removal", description: null, services: ["Junk removal"], ownerName: null,
    contactMethods: [
      { type: "phone", value: "619-916-8419", status: "verified", confidence: 0.8, sourceUrl: POSTURL },
      { type: "website", value: WEB, status: "uncertain", confidence: 0.5, sourceUrl: IG },
    ],
    locations: [], socialProfiles: [], sourceChecks: [], qaResults: [],
    sourceLog: [
      { url: IG, sourceType: "instagram", discoveredFrom: null, discoveryMethod: "seed", fetchStatus: "unavailable", blockedReason: "login wall", primaryPassDone: false, verificationPassDone: false },
      { url: POSTURL, sourceType: "instagram", discoveredFrom: IG, discoveryMethod: "public_index", fetchStatus: "ok", indexedOnly: true, primaryPassDone: true, verificationPassDone: false },
      { url: WEB, sourceType: "website", discoveredFrom: IG, discoveryMethod: "search_discovery", fetchStatus: "ok", primaryPassDone: true, verificationPassDone: true },
    ],
    signals: { hasJsonLd: true, hasHttps: true, hasMetaDescription: true, hasAggregateRating: false },
    socialRecovery: { platform: "instagram", status: "found", handle: "sdjunkseekers", displayName: "junkseekers", postsFound: 1, backlinkCandidates: 2, provider: "exa", reason: null },
  } as BusinessGraph;
  const p = reconcileGraph(g, IG);
  assert.equal(p.entities.sourceType, "INSTAGRAM_BUSINESS_ACCOUNT");
  assert.equal(p.entities.entityType, "BUSINESS");
  assert.equal(p.entities.business?.name, "Junk Seekers");
  assert.equal(p.website.status, "CONFIRMED"); // links back to @sdjunkseekers
  assert.equal(p.identity.identityConfidence, "confirmed");
  assert.equal(p.contacts.phones[0].status, "CONFIRMED"); // the account's own post is first-party
  const byUrl = Object.fromEntries(p.sources.map((s) => [s.url, s]));
  assert.equal(byUrl[POSTURL].fetchStatus, "indexed_public");
  assert.equal(byUrl[POSTURL].association, "confirmed_first_party");
  assert.equal(byUrl[WEB].linksToSeed, true);
  assert.equal(byUrl[IG].fetchStatus, "blocked_login_wall");
  assert.ok(p.limitations.some((l) => l.code === "INSTAGRAM_PROFILE_LOGIN_WALLED" && l.message.includes("1 public post")));
  assert.ok(p.entities.notes.some((n) => /cross-link verified/.test(n)));
  assert.equal(saveBlockReason(p), null);
});

test("reconcile: instagram personal account operating a business -> PERSON_OPERATING_BUSINESS; follower-type language is never evidence", () => {
  const IG = "https://www.instagram.com/mariaflores/", WEB = "https://floresclean.com/";
  const g: BusinessGraph = {
    businessName: { value: "Flores Cleaning LLC", sourceUrl: WEB, sourceType: "website", strength: 3 },
    nameCandidates: [{ value: "Maria Flores", sourceUrl: IG, sourceType: "instagram", strength: 2 }, { value: "Flores Cleaning LLC", sourceUrl: WEB, sourceType: "website", strength: 3 }],
    pageMeta: [
      { url: IG, requestedUrl: IG, sourceType: "instagram", isSeed: true, title: "Maria Flores", ogTitle: "Maria Flores", description: "Owner of Flores Cleaning LLC • Book your deep clean, DM for pricing • 10k followers" },
      { url: WEB, requestedUrl: WEB, sourceType: "website", isSeed: false, linksToSeed: true, title: "Flores Cleaning LLC", ogTitle: "Flores Cleaning LLC", description: null },
    ],
    category: "Cleaning", description: null, services: [], ownerName: "Maria Flores",
    contactMethods: [{ type: "website", value: WEB, status: "verified", confidence: 0.9, sourceUrl: IG }],
    locations: [], socialProfiles: [], sourceChecks: [], qaResults: [],
    sourceLog: [
      { url: IG, sourceType: "instagram", discoveredFrom: null, discoveryMethod: "seed", fetchStatus: "unavailable", blockedReason: "login wall", primaryPassDone: false, verificationPassDone: false },
      { url: WEB, sourceType: "website", discoveredFrom: IG, discoveryMethod: "search_discovery", fetchStatus: "ok", primaryPassDone: true, verificationPassDone: true },
    ],
    signals: { hasJsonLd: false, hasHttps: true, hasMetaDescription: false, hasAggregateRating: false },
  } as BusinessGraph;
  const p = reconcileGraph(g, IG);
  assert.equal(p.entities.sourceType, "INSTAGRAM_PERSONAL_ACCOUNT");
  assert.equal(p.entities.entityType, "PERSON_OPERATING_BUSINESS");
  assert.equal(p.entities.person?.name, "Maria Flores");
  assert.equal(p.entities.person?.facebookUsername, "@mariaflores");
  assert.equal(p.entities.business?.name, "Flores Cleaning LLC");
  assert.equal(p.entities.relationship?.relationshipType, "OWNER");
  assert.equal(p.entities.relationship?.basis, "corroborated"); // website names Maria Flores
  assert.equal(saveBlockReason(p), null);
});

test("live-observed: website sub-page titles and taglines never create a business-name conflict; they support the name they contain", () => {
  const IG = "https://www.instagram.com/sdjunkseekers/", WEB = "https://junkseekers.com/";
  const g: BusinessGraph = {
    businessName: { value: "Junk Seekers", sourceUrl: WEB, sourceType: "website", strength: 3 },
    nameCandidates: [
      { value: "Junk Seekers", sourceUrl: WEB, sourceType: "website", strength: 3 },
      { value: "San Diego's Trusted Hauling & Junk Removal", sourceUrl: WEB, sourceType: "website", strength: 2 },
      { value: "San Diego", sourceUrl: WEB, sourceType: "website", strength: 1 },
      { value: "Contact Junk Seekers", sourceUrl: WEB + "contact", sourceType: "website", strength: 2 },
      { value: "About Junk Seekers", sourceUrl: WEB + "about", sourceType: "website", strength: 2 },
      { value: "Areas We Serve in San Diego County", sourceUrl: WEB + "areas-we-serve", sourceType: "website", strength: 2 },
      { value: "Appliance Removal Services in San Diego", sourceUrl: WEB + "appliance-removal-services", sourceType: "website", strength: 2 },
      { value: "Junk Seekers", sourceUrl: "https://www.youtube.com/@JunkSeekers", sourceType: "youtube", strength: 2 },
    ],
    pageMeta: [
      { url: IG, requestedUrl: IG, sourceType: "instagram", isSeed: true, title: null, ogTitle: null, description: null },
      ...[WEB, WEB + "contact", WEB + "about", WEB + "areas-we-serve", WEB + "appliance-removal-services"].map((u) => ({ url: u, requestedUrl: u, sourceType: "website", isSeed: false, linksToSeed: true, title: null, ogTitle: null, description: null })),
    ],
    category: "Junk Removal", description: null, services: ["Junk removal"], ownerName: null,
    contactMethods: [
      { type: "phone", value: "(619) 916-8419", status: "verified", confidence: 0.9, sourceUrl: WEB },
      { type: "email", value: "info@junkseekers.com", status: "verified", confidence: 0.9, sourceUrl: WEB + "contact" },
      { type: "website", value: WEB, status: "verified", confidence: 0.9, sourceUrl: IG },
    ],
    locations: [{ name: null, address: null, city: "Spring Valley", state: "CA", postalCode: null, locationType: "primary", status: "verified", confidence: 0.8, sourceUrl: WEB }],
    socialProfiles: [], sourceChecks: [], qaResults: [],
    sourceLog: [
      { url: IG, sourceType: "instagram", discoveredFrom: null, discoveryMethod: "seed", fetchStatus: "ok", genericPlatformContent: true, primaryPassDone: true, verificationPassDone: true },
      { url: WEB, sourceType: "website", discoveredFrom: IG, discoveryMethod: "search_discovery", fetchStatus: "ok", primaryPassDone: true, verificationPassDone: true },
      ...["contact", "about", "areas-we-serve", "appliance-removal-services"].map((p) => ({ url: WEB + p, sourceType: "website", discoveredFrom: WEB, discoveryMethod: "website_crawl" as const, fetchStatus: "ok" as const, primaryPassDone: true, verificationPassDone: true })),
    ],
    signals: { hasJsonLd: true, hasHttps: true, hasMetaDescription: true, hasAggregateRating: false },
    socialRecovery: { platform: "instagram", status: "found", handle: "sdjunkseekers", displayName: null, postsFound: 0, backlinkCandidates: 3, provider: "exa", reason: null },
  } as BusinessGraph;
  const p = reconcileGraph(g, IG);
  assert.equal(p.conflicts.length, 0);
  assert.equal(p.entities.business?.name, "Junk Seekers");
  assert.equal(p.entities.business?.candidates.length, 1); // every title variant folded into the one name
  assert.ok(p.entities.business!.candidates[0].sources.length >= 4); // site + contact + about + youtube
  assert.equal(p.identity.identityConfidence, "confirmed"); // website links back to @sdjunkseekers + first-party phone
  assert.equal(p.entities.entityType, "BUSINESS");
  assert.equal(saveBlockReason(p), null);
});
