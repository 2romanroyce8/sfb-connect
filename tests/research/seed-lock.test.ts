import { test } from "node:test";
import assert from "node:assert/strict";
import { matchPageToSeed, facebookIdFromUrl, urlNamesSeed, isPlatformBoilerplateUrl, type SeedEntity, type PageFacts } from "../../lib/research/entityMatch";
import { reconcileGraph, saveBlockReason } from "../../lib/research/reconcile";
import type { BusinessGraph } from "../../lib/research/types";

// The exact production incident, 2026-10-05: facebook.com/profile.php?id=61574342053650 (Supreme Air LLC)
// came back as "How Youtube Works" with phone.gd as its website.
const SEED: SeedEntity = {
  url: "https://www.facebook.com/profile.php?id=61574342053650",
  canonicalUrl: "https://www.facebook.com/people/Supreme-Air-LLC/61574342053650/",
  platform: "facebook", platformId: "61574342053650", username: null,
  displayName: "Supreme Air LLC", entityHint: "business",
  phones: ["(732) 213-0373"], emails: [], regions: ["NJ"], domains: [], resolved: true, resolvedFrom: "page",
};
const facts = (over: Partial<PageFacts>): PageFacts => ({
  url: "https://example.com/", sourceType: "website", isSeed: false, discoveryMethod: "search_discovery", parentStatus: null, parentIsChrome: false, parentIsSeed: false,
  names: [], phones: [], emails: [], regions: [], outboundUrls: [], isGenericPlatformContent: false, onTrustedOfficialDomain: false, ...over,
});

test("TEST 10: profile.php?id= -- the exact numeric Facebook id is the seed identity, across every URL shape", () => {
  assert.equal(facebookIdFromUrl("https://www.facebook.com/profile.php?id=61574342053650"), "61574342053650");
  assert.equal(facebookIdFromUrl("https://www.facebook.com/people/Supreme-Air-LLC/61574342053650/"), "61574342053650");
  assert.equal(facebookIdFromUrl("https://www.facebook.com/p/Supreme-Air-LLC-61574342053650/"), "61574342053650");
  assert.ok(urlNamesSeed("https://m.facebook.com/p/Supreme-Air-LLC-61574342053650/", SEED));
  assert.ok(!urlNamesSeed("https://www.facebook.com/people/Other-Biz/99999999999/", SEED));
});

test("TEST 1: the seed URL itself is MATCHED; its identity is the lock; its m./p/ variants are the seed too, even as login walls", () => {
  assert.equal(matchPageToSeed(facts({ url: SEED.url, isSeed: true, discoveryMethod: "seed" }), SEED).status, "MATCHED");
  assert.equal(matchPageToSeed(facts({ url: "https://m.facebook.com/people/Supreme-Air-LLC/61574342053650/", sourceType: "facebook", isGenericPlatformContent: true, discoveryMethod: "social_link" }), SEED).status, "MATCHED");
  assert.equal(matchPageToSeed(facts({ url: "https://www.facebook.com/p/Supreme-Air-LLC-61574342053650/", sourceType: "facebook", discoveryMethod: "social_link" }), SEED).status, "MATCHED");
});

test("TEST 5 / boilerplate: youtube navigation, manifests, feeds, CDN assets and lookup sites are REJECTED before any field can flow", () => {
  for (const u of ["https://www.youtube.com/howyoutubeworks/?utm_campaign=ytgen", "https://www.youtube.com/creators/", "https://www.youtube.com/ads/", "https://www.youtube.com/new", "https://www.youtube.com/opensearch?locale=en_US", "https://www.youtube.com/manifest.webmanifest", "https://www.youtube.com/s/desktop/x/img/favicon.ico", "https://www.youtube.com/feeds/videos.xml?channel_id=UC1", "https://www.facebook.com/data/manifest/?x=0", "https://tv.youtube.com/learn/nflsundayticket/", "https://phone.gd/phone/573-221-3030", "https://www.whitepages.com/phone/1-573-221-3030"]) {
    assert.ok(isPlatformBoilerplateUrl(u), u);
    assert.equal(matchPageToSeed(facts({ url: u, sourceType: "youtube", names: ["How Youtube Works"] }), SEED).status, "REJECTED", u);
  }
  for (const u of ["https://claritycheck.com/928-221-0373", "https://sync.me/search/?number=17372007373", "https://anylookup.example/phone/573-221-3030"]) assert.ok(isPlatformBoilerplateUrl(u), u);
  assert.ok(!isPlatformBoilerplateUrl("https://www.youtube.com/@JunkSeekers"));
  assert.ok(!isPlatformBoilerplateUrl("https://supreme-air.com/contact"));
});

test("TEST 2 / phone.gd class: a search hit that publishes a different identity and has no tie to the seed is REJECTED -- it can never become the website", () => {
  // by URL shape: a path that IS a phone number is a lookup page, rejected before any content is read
  assert.equal(matchPageToSeed(facts({ url: "https://randomlookup.example/phone/573-221-3030", names: ["Phone Number Lookup 573-221-3030"] }), SEED).status, "REJECTED");
  // by content: a page with an innocuous URL that publishes a different identity and no tie to the seed
  const m = matchPageToSeed(facts({ url: "https://randomlookup.example/report/x1", names: ["Phone Number Lookup 573-221-3030"], phones: ["573-221-3030"], emails: ["5732213030@email.swbw.com"] }), SEED);
  assert.equal(m.status, "REJECTED");
  assert.ok(m.reasons[0].includes("different identity"));
});

test("TEST 3: the official website is MATCHED when it links to the exact seed id, or when its name AND phone match the seed", () => {
  const byBacklink = matchPageToSeed(facts({ url: "https://supreme-air.com/", names: ["Supreme Air LLC"], outboundUrls: ["https://www.facebook.com/profile.php?id=61574342053650"] }), SEED);
  assert.equal(byBacklink.status, "MATCHED");
  const byNamePhone = matchPageToSeed(facts({ url: "https://supreme-air.com/", names: ["Supreme Air"], phones: ["732-213-0373"] }), SEED);
  assert.equal(byNamePhone.status, "MATCHED");
  const byNameOnly = matchPageToSeed(facts({ url: "https://supreme-air.com/", names: ["Supreme Air LLC"] }), SEED);
  assert.equal(byNameOnly.status, "PROBABLE_MATCH");
});

test("TEST 4: an unrelated external link on the official website is POSSIBLE at best, REJECTED when it publishes another identity -- and such pages are dead ends", () => {
  const sponsor = matchPageToSeed(facts({ url: "https://hvacparts-superstore.example/", names: ["HVAC Parts Superstore"], discoveryMethod: "link_extraction", parentStatus: "MATCHED" }), SEED);
  assert.equal(sponsor.status, "REJECTED");
  const anon = matchPageToSeed(facts({ url: "https://somepage.example/", names: [], discoveryMethod: "link_extraction", parentStatus: "MATCHED" }), SEED);
  assert.equal(anon.status, "POSSIBLE_MATCH");
});

test("TEST 6 (live, Maryland): a same-name business that publishes a different phone or sits in another state is POSSIBLE at most -- it never contributes", () => {
  const md = matchPageToSeed(facts({ url: "https://supremeairllc.org/", names: ["Supreme Air LLC"], phones: ["410-781-1002"], regions: ["MD"] }), SEED);
  assert.equal(md.status, "POSSIBLE_MATCH");
  assert.ok(md.reasons.some((r) => /different business with the same name/.test(r)));
  const sameNoPhone = matchPageToSeed(facts({ url: "https://supreme-air.com/", names: ["Supreme Air LLC"] }), SEED);
  assert.equal(sameNoPhone.status, "PROBABLE_MATCH");
  const samePhone = matchPageToSeed(facts({ url: "https://supreme-air.com/", names: ["Supreme Air LLC"], phones: ["(732) 213-0373"], regions: ["NJ"] }), SEED);
  assert.equal(samePhone.status, "MATCHED");
  assert.ok(matchPageToSeed(facts({ url: "https://supremeairtx.example/", names: ["Supreme Air Conditioning"], phones: ["512-555-0100"] }), SEED).status !== "MATCHED");
});
test("regions in text: 'serving New Jersey' -> NJ; 'Halethorpe, MD 21227' -> MD; bare words never", () => {
  const { regionsInText } = require("../../lib/research/entityMatch") as typeof import("../../lib/research/entityMatch");
  assert.deepEqual(regionsInText("HVAC Company serving New Jersey"), ["NJ"]);
  assert.deepEqual(regionsInText("1234 Main St, Halethorpe, MD 21227"), ["MD"]);
  assert.deepEqual(regionsInText("We make junk disappear"), []);
});

test("TEST 8: a social account with a different username matches only with corroborating evidence", () => {
  const noEvidence = matchPageToSeed(facts({ url: "https://instagram.com/supremeair_nj", sourceType: "instagram", names: ["supremeair_nj"] }), SEED);
  assert.equal(noEvidence.status, "REJECTED"); // publishes a different name, no tie
  const withPhone = matchPageToSeed(facts({ url: "https://instagram.com/supremeair_nj", sourceType: "instagram", names: ["Supreme Air LLC"], phones: ["(732) 213-0373"] }), SEED);
  assert.equal(withPhone.status, "MATCHED");
});

test("END TO END: the Supreme Air graph as it was crawled -- with the lock, the business is Supreme Air LLC and nothing from phone.gd / YouTube survives", () => {
  const FB = "https://www.facebook.com/profile.php?id=61574342053650", FBF = "https://www.facebook.com/people/Supreme-Air-LLC/61574342053650/", PG = "https://phone.gd/phone/573-221-3030", HYW = "https://www.youtube.com/howyoutubeworks/?utm_campaign=ytgen", CID = "https://www.youtube.com/@caller-id";
  const g = {
    seedEntity: SEED,
    businessName: { value: "Supreme Air LLC", sourceUrl: FBF, sourceType: "facebook", strength: 3 }, // name lock output
    nameCandidates: [
      { value: "Supreme Air LLC", sourceUrl: FBF, sourceType: "facebook", strength: 2 },
      { value: "Phone Number Lookup 573", sourceUrl: PG, sourceType: "website", strength: 1 },
      { value: "Caller ID", sourceUrl: CID, sourceType: "youtube", strength: 2 },
      { value: "How Youtube Works", sourceUrl: HYW, sourceType: "youtube", strength: 3 },
    ],
    pageMeta: [
      { url: FBF, requestedUrl: FB, sourceType: "facebook", isSeed: true, trusted: true, entityMatch: { status: "MATCHED", reasons: ["seed"] }, title: "Supreme Air LLC", ogTitle: "Supreme Air LLC", description: "Supreme Air LLC. 867 followers. HVAC Company serving New Jersey" },
      { url: PG, requestedUrl: PG, sourceType: "website", isSeed: false, trusted: false, entityMatch: { status: "REJECTED", reasons: ["lookup site"] }, title: "Phone Number Lookup", ogTitle: "Phone Number Lookup 573-221-3030", description: null },
      { url: CID, requestedUrl: CID, sourceType: "youtube", isSeed: false, trusted: false, entityMatch: { status: "REJECTED", reasons: ["different identity"] }, title: "Caller ID", ogTitle: "Caller ID", description: null },
      { url: HYW, requestedUrl: HYW, sourceType: "youtube", isSeed: false, trusted: false, entityMatch: { status: "REJECTED", reasons: ["platform navigation"] }, title: "How YouTube Works", ogTitle: "How YouTube Works", description: null },
    ],
    category: "HVAC Company", description: "HVAC Company serving New Jersey", services: [], ownerName: null,
    contactMethods: [
      { type: "phone", value: "(732) 213-0373", status: "verified", confidence: 0.9, sourceUrl: FBF },
      { type: "phone", value: "+15732213030", status: "uncertain", confidence: 0.5, sourceUrl: PG },
      { type: "email", value: "5732213030@email.swbw.com", status: "uncertain", confidence: 0.5, sourceUrl: PG },
      { type: "website", value: PG, status: "uncertain", confidence: 0.4, sourceUrl: PG },
    ],
    locations: [{ name: null, address: null, city: "Hannibal", state: "MO", postalCode: null, locationType: "primary", status: "uncertain", confidence: 0.4, sourceUrl: PG }],
    socialProfiles: [{ platform: "youtube", handle: "caller-id", url: CID, displayName: null, status: "verified", confidence: 0.8, sourceUrl: PG }],
    sourceChecks: [], qaResults: [],
    sourceLog: [
      { url: FB, sourceType: "facebook", discoveredFrom: null, discoveryMethod: "seed", fetchStatus: "ok", primaryPassDone: true, verificationPassDone: true },
      { url: PG, sourceType: "website", discoveredFrom: null, discoveryMethod: "search_discovery", fetchStatus: "ok", primaryPassDone: true, verificationPassDone: true },
      { url: CID, sourceType: "youtube", discoveredFrom: PG, discoveryMethod: "social_link", fetchStatus: "ok", primaryPassDone: true, verificationPassDone: true },
      { url: HYW, sourceType: "youtube", discoveredFrom: CID, discoveryMethod: "social_link", fetchStatus: "ok", primaryPassDone: true, verificationPassDone: true },
    ],
    signals: { hasJsonLd: false, hasHttps: true, hasMetaDescription: true, hasAggregateRating: false },
  } as unknown as BusinessGraph;
  const p = reconcileGraph(g, FB);
  assert.equal(p.entities.business?.name, "Supreme Air LLC");
  assert.ok(!p.entities.business!.candidates.some((c) => /youtube works|caller id|phone number lookup/i.test(c.value)));
  assert.equal(p.website.value, null); // phone.gd never becomes the website
  assert.deepEqual(p.contacts.phones.map((x) => x.normalized), ["+17322130373"]); // the 573 number is gone
  assert.equal(p.contacts.emails.length, 0); // swbw.com email gone
  assert.equal(p.locations.physical.length, 0); // Hannibal, MO gone
  assert.ok(p.socialProfiles.every((sp) => sp.platform !== "youtube" || sp.association === "rejected_unrelated"));
  // the seed's own Facebook account is never rejected because a login-walled m. variant shares its path
  const g3 = { ...(g as any), socialProfiles: [{ platform: "facebook", handle: null, url: "https://facebook.com/people/Supreme-Air-LLC/61574342053650", displayName: null, status: "uncertain", confidence: 0.5, sourceUrl: FBF }], sourceLog: [...(g as any).sourceLog, { url: "https://m.facebook.com/people/Supreme-Air-LLC/61574342053650/", sourceType: "facebook", discoveredFrom: FB, discoveryMethod: "social_link", fetchStatus: "ok", genericPlatformContent: true, primaryPassDone: true, verificationPassDone: false }] } as unknown as BusinessGraph;
  const p3 = reconcileGraph(g3, FB);
  assert.equal(p3.socialProfiles.find((sp) => sp.platform === "facebook")?.association, "confirmed_first_party");
  // phone.gd's contamination is still (correctly) removed in this graph, but the seed's own account must never be in the removed list
  const removedMsg = p3.limitations.find((l) => l.code === "FIELDS_REMOVED_UNMATCHED_SOURCE")?.message ?? "";
  assert.ok(!/facebook/i.test(removedMsg), removedMsg);
  // and a share-link that is not a profile, plus a rejected source's own X account, never survive as the business's socials
  const gg = g as any; const g2 = { ...gg, socialProfiles: [...gg.socialProfiles, { platform: "linkedin", handle: null, url: "https://linkedin.com/sharing/share-offsite", displayName: null, status: "verified", confidence: 0.8, sourceUrl: PG }, { platform: "x", handle: "PRcom", url: "https://x.com/PRcom", displayName: null, status: "verified", confidence: 0.8, sourceUrl: PG }], sourceLog: [...gg.sourceLog, { url: "https://twitter.com/PRcom", sourceType: "x", discoveredFrom: PG, discoveryMethod: "social_link", fetchStatus: "ok", primaryPassDone: true, verificationPassDone: true }], pageMeta: [...gg.pageMeta, { url: "https://twitter.com/PRcom", requestedUrl: "https://twitter.com/PRcom", sourceType: "x", isSeed: false, trusted: false, entityMatch: { status: "REJECTED", reasons: ["different identity"] }, title: null, ogTitle: "PR.com", description: null }] } as unknown as BusinessGraph;
  const p2 = reconcileGraph(g2, FB);
  assert.ok(p2.socialProfiles.filter((sp) => sp.platform === "linkedin" || sp.platform === "x").every((sp) => sp.association === "rejected_unrelated"));
  assert.ok(p.limitations.some((l) => l.code === "FIELDS_REMOVED_UNMATCHED_SOURCE"));
  const byUrl = Object.fromEntries(p.sources.map((s) => [s.url, s]));
  assert.equal(byUrl[FB].entityMatch, "MATCHED");
  assert.equal(byUrl[PG].entityMatch, "REJECTED");
  assert.equal(byUrl[HYW].entityMatch, "REJECTED");
  assert.equal(p.seed?.platformId, "61574342053650");
  assert.equal(saveBlockReason(p), null);
});
