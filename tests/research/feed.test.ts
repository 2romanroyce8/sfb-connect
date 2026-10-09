import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFeed, itemMatchesTarget, rssFeedSource, normalizeState } from "../../lib/research/feed/sources/rss";
import { exaFeedSource } from "../../lib/research/feed/sources/exa";
import { toCandidates, isAccepted, nameFromTitle, extractCityState, extractProseNames, isChainOrFranchise, labelIdentity } from "../../lib/research/feed/quality";
import { dedupeBatch, flagKnown } from "../../lib/research/feed/dedupe";
import { runFeed, taskContext } from "../../lib/research/feed/run";
import type { FeedSource, FeedTarget, RawFinding } from "../../lib/research/feed/types";

const tampa: FeedTarget = { id: "t-tampa", vertical: "roofing", city: "Tampa", state: "FL", queries: null, active: true };
const raw = (over: Partial<RawFinding>): RawFinding => ({ sourceKind: "exa", sourceUrl: "https://exa.ai/search?q=x", title: "", snippet: "", url: null, publishedAt: null, targetId: tampa.id, ...over });

test("rss parser reads RSS 2.0 items and Atom entries, strips HTML and CDATA, parses dates", () => {
  const xml = `<?xml version="1.0"?><rss><channel><title>Feed</title>
    <item><title><![CDATA[Bay Area Roofing &amp; Exteriors wins Tampa, FL hospital re-roof]]></title><link>https://news.example/a</link><description>&lt;p&gt;Tampa-based &lt;b&gt;Bay Area Roofing &amp; Exteriors&lt;/b&gt; landed the job.&lt;/p&gt;</description><pubDate>Fri, 09 Oct 2026 12:00:00 -0400</pubDate></item>
    </channel></rss>
    <feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Atom item</title><link rel="alternate" href="https://news.example/b"/><summary>Orlando, Florida roofing permit surge</summary><updated>2026-10-08T10:00:00Z</updated></entry></feed>`;
  const items = parseFeed(xml);
  assert.equal(items.length, 2);
  assert.equal(items[0].title, "Bay Area Roofing & Exteriors wins Tampa, FL hospital re-roof");
  assert.equal(items[0].link, "https://news.example/a");
  assert.equal(items[0].summary, "Tampa-based Bay Area Roofing & Exteriors landed the job.");
  assert.equal(items[0].publishedAt, "2026-10-09T16:00:00.000Z");
  assert.equal(items[1].link, "https://news.example/b");
  assert.equal(items[1].publishedAt, "2026-10-08T10:00:00.000Z");
});

test("rss relevance: an item must name the target city plus the state or the vertical", () => {
  assert.equal(itemMatchesTarget({ title: "Tampa roofer expands", link: null, summary: "", publishedAt: null }, tampa), true);
  assert.equal(itemMatchesTarget({ title: "Tampa, Florida hospital opens", link: null, summary: "", publishedAt: null }, tampa), true);
  assert.equal(itemMatchesTarget({ title: "Houston roofer expands", link: null, summary: "", publishedAt: null }, tampa), false, "wrong city is not a prospect");
  assert.equal(itemMatchesTarget({ title: "Tampa Bay Lightning win", link: null, summary: "hockey", publishedAt: null }, tampa), false, "city without state/vertical is noise");
});

test("rss source fetches each feed once per run, drops stale items, and yields url-less findings", async () => {
  let calls = 0;
  const xml = `<rss><channel><item><title>Suncoast Roofing Co. opens Tampa, FL branch</title><link>https://n/1</link><pubDate>${new Date().toUTCString()}</pubDate></item><item><title>Old Tampa roofing news</title><link>https://n/2</link><pubDate>Tue, 01 Jan 2019 00:00:00 GMT</pubDate></item></channel></rss>`;
  const fetchImpl = (async () => { calls++; return new Response(xml, { status: 200 }); }) as unknown as typeof fetch;
  const src = rssFeedSource([{ id: "f", url: "https://feed.example/rss", label: "x", active: true }], { fetchImpl });
  const a = await src.pull(tampa, { limit: 10 });
  const b = await src.pull({ ...tampa, id: "t2", city: "Orlando" }, { limit: 10 });
  assert.equal(calls, 1, "one fetch shared across targets");
  assert.equal(a.length, 1);
  assert.equal(a[0].url, null);
  assert.equal(b.length, 0);
});

test("exa source maps company results and never throws on provider failure", async () => {
  const fetchImpl = (async (_u: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    assert.equal(body.category, "company");
    return new Response(JSON.stringify({ results: [{ title: "Suncoast Roofing | Tampa's Trusted Roofer", url: "https://suncoastroofing.com/", text: "Family-owned roofing in Tampa, FL. Call (813) 555-0142.", publishedDate: "2026-09-01" }] }), { status: 200 });
  }) as unknown as typeof fetch;
  const src = exaFeedSource({ apiKey: "k", fetchImpl, log: false });
  const out = await src.pull(tampa, { limit: 5 });
  assert.ok(out.length >= 1);
  assert.equal(out[0].url, "https://suncoastroofing.com/");
  const broken = exaFeedSource({ apiKey: "k", fetchImpl: (async () => { throw new Error("boom"); }) as unknown as typeof fetch, log: false });
  assert.deepEqual(await broken.pull(tampa, { limit: 5 }), []);
  assert.equal(exaFeedSource({ apiKey: null }).isConfigured(), false);
});

test("name from title picks the brand segment, not 'Home' or a service phrase", () => {
  assert.equal(nameFromTitle("Suncoast Roofing | Tampa's Trusted Roofer", "suncoastroofing.com"), "Suncoast Roofing");
  assert.equal(nameFromTitle("Home - Bayshore Exteriors", "bayshoreexteriors.com"), "Bayshore Exteriors");
  assert.equal(nameFromTitle("Roof Repair Tampa | Westshore Roofing Co", "westshoreroofing.com"), "Westshore Roofing Co");
});

test("geo: target city wins, otherwise first City, ST pair; state names normalize; nothing → nulls", () => {
  assert.deepEqual(extractCityState("Serving Tampa and the bay area", tampa), { city: "Tampa", state: "FL" });
  assert.deepEqual(extractCityState("Based in Sarasota, Florida since 1998", tampa), { city: "Sarasota", state: "FL" });
  assert.deepEqual(extractCityState("Roofing done right.", tampa), { city: null, state: null });
  assert.equal(normalizeState("florida"), "FL");
  assert.equal(normalizeState("ON"), null, "Ontario is not a US state");
});

test("quality flags: missing city/state, out-of-target state, chains, directories and junk names are dropped — with reasons", () => {
  const c = (over: Partial<RawFinding>) => toCandidates(raw(over), tampa)[0];
  assert.deepEqual(c({ title: "Suncoast Roofing", url: "https://suncoastroofing.com", snippet: "Roofing done right." }).flags, ["missing_city_state"]);
  assert.deepEqual(c({ title: "Peach State Roofing", url: "https://peachstateroofing.com", snippet: "Atlanta, GA roofing" }).flags, ["state_mismatch"]);
  assert.ok(c({ title: "GAF Roofing", url: "https://www.gaf.com/en-us", snippet: "Tampa, FL" }).flags.includes("chain_or_franchise"));
  assert.ok(c({ title: "Suncoast Roofing - Yelp", url: "https://www.yelp.com/biz/suncoast-roofing-tampa", snippet: "Tampa, FL" }).flags.includes("directory_or_aggregator"));
  assert.deepEqual(toCandidates(raw({ title: "Best Roofers in Tampa", url: "https://roofersoftampa.com", snippet: "Tampa, FL" }), tampa), [], "a purely generic title names no business");
  assert.ok(c({ title: "John Smith", url: "https://johnsmith.com", snippet: "Tampa, FL" }).flags.includes("junk_name"));
  const good = c({ title: "Suncoast Roofing | Tampa's Trusted Roofer", url: "https://suncoastroofing.com/", snippet: "Family-owned roofing in Tampa, FL. Call (813) 555-0142." });
  assert.deepEqual(good.flags, []);
  assert.equal(good.phoneE164, "+18135550142");
  assert.equal(good.city, "Tampa");
  assert.equal(isAccepted(good), true);
  assert.equal(isChainOrFranchise("Home Depot Roofing Services", "homedepot.com", ""), true);
  // Live-observed on the first real run (2026-10-09): franchise location pages slipped through.
  assert.ok(c({ title: "Honest Abe Roofing Orlando", url: "https://www.honestaberoofing.com/orlando-fl", snippet: "Orlando, FL" }).flags.includes("chain_or_franchise"));
  assert.ok(c({ title: "Gale Force Roofing & Restoration", url: "https://www.lifetimequalityroofing.com/locations/tampa-florida/", snippet: "Tampa, FL" }).flags.includes("chain_or_franchise"));
  assert.equal(isChainOrFranchise("Suncoast Roofing", "suncoastroofing.com", "We are a locally owned business"), false);
});

test("identity labels are honest: never 'confirmed'; rss → unverified/name_only; domain+phone agreement → corroborated", () => {
  assert.equal(labelIdentity({ name: "Suncoast Roofing", canonicalDomain: "suncoastroofing.com", phoneE164: "+18135550142", city: "Tampa", sourceKind: "exa" }), "corroborated");
  assert.equal(labelIdentity({ name: "Suncoast Roofing", canonicalDomain: "tamparoofpros.net", phoneE164: null, city: "Tampa", sourceKind: "exa" }), "name_only", "domain does not name the business");
  assert.equal(labelIdentity({ name: "Suncoast Roofing", canonicalDomain: null, phoneE164: null, city: "Tampa", sourceKind: "rss" }), "unverified");
  const rssCands = toCandidates(raw({ sourceKind: "rss", sourceUrl: "https://news.example/a", title: "Bay Area Roofing & Exteriors wins Tampa, FL hospital re-roof", snippet: "Tampa-based Bay Area Roofing & Exteriors landed the job alongside Gulf Coast Construction." }), tampa);
  assert.ok(rssCands.some((x) => x.name === "Bay Area Roofing & Exteriors"));
  assert.ok(rssCands.every((x) => x.identityLabel === "unverified" && x.website === null));
  assert.deepEqual(extractProseNames("Tampa Bay Lightning beat Florida Panthers"), []);
});

test("dedupe: same domain twice in a batch, known CRM phone, prior finding", () => {
  const a = toCandidates(raw({ title: "Suncoast Roofing", url: "https://suncoastroofing.com/", snippet: "Tampa, FL (813) 555-0142" }), tampa)[0];
  const b = toCandidates(raw({ title: "Suncoast Roofing Inc", url: "https://www.suncoastroofing.com/about", snippet: "Tampa, FL" }), tampa)[0];
  const c = toCandidates(raw({ title: "Westshore Roofing", url: "https://westshoreroofing.com/", snippet: "Tampa, FL (813) 555-0199" }), tampa)[0];
  const batch = dedupeBatch([a, b, c]);
  assert.deepEqual(batch.map((x) => x.flags.includes("duplicate_in_batch")), [false, true, false]);
  const known = flagKnown(batch, { crm: new Set(["p:+18135550199"]), prior: new Set(["d:suncoastroofing.com"]) });
  assert.ok(known[0].flags.includes("duplicate_prior_finding"));
  assert.ok(known[2].flags.includes("duplicate_in_crm"));
  assert.equal(known.filter(isAccepted).length, 0);
});

test("runFeed (dry run, fake source, fake service): groups accepted findings into one task per target, honours the deadline", async () => {
  const src: FeedSource = { kind: "exa", isConfigured: () => true, async pull(t) { return [
    raw({ targetId: t.id, title: `${t.city} Roofing Pros`, url: `https://${t.city.toLowerCase()}roofingpros.com/`, snippet: `${t.city}, ${t.state} · (813) 555-01${t.city.length}0` }),
    raw({ targetId: t.id, title: "GAF", url: "https://www.gaf.com/", snippet: `${t.city}, ${t.state}` }),
  ]; } };
  const empty = { data: [], error: null };
  const service = { from: () => ({ select: () => ({ limit: async () => empty, eq: () => ({ limit: async () => empty }) }) }) } as never;
  const orlando = { ...tampa, id: "t-orlando", city: "Orlando" };
  const s = await runFeed({ service, trigger: "cli", sources: [src], targets: [tampa, orlando], dryRun: true });
  assert.deepEqual(s.targetsRun, ["t-tampa", "t-orlando"]);
  assert.equal(s.pulled, 4);
  assert.equal(s.accepted, 2);
  assert.equal(s.dropped.chain_or_franchise, 2);
  assert.deepEqual(s.tasksCreated, [], "dry run files nothing");

  let t = 0;
  const slow = await runFeed({ service, trigger: "cli", sources: [src], targets: [tampa, orlando], dryRun: true, deadlineMs: 5, now: () => (t += 10) });
  assert.deepEqual(slow.targetsSkipped, ["t-tampa", "t-orlando"], "past the deadline nothing new starts; skipped targets are reported for the next run");

  const ctx = taskContext(tampa, [toCandidates(raw({ title: "Suncoast Roofing", url: "https://suncoastroofing.com/", snippet: "Tampa, FL (813) 555-0142" }), tampa)[0]]);
  assert.match(ctx, /CANDIDATES, not confirmed/);
  assert.match(ctx, /Do not contact anyone from this task/);
  assert.match(ctx, /Suncoast Roofing\*\* · corroborated/);
});
