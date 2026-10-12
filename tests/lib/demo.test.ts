import { test } from "node:test";
import assert from "node:assert/strict";
import { extractServices, toneNotesFromText, extractSocials, offerLineFrom, splitMarket, slugify, verticalFrom, classifyNiche } from "../../lib/demo/build";
import { resendDecision, signPending, readPending, MAX_RESENDS, RESEND_COOLDOWN_SEC } from "../../lib/demo/verification";
import { parseDemoProfile } from "../../lib/demo/provision";

test("build show: services come from nav/headings, boilerplate and non-services are dropped, de-duplicated", () => {
  const s = extractServices(["Home", "About Us", "Roof Replacement", "Roof Repair", "Gutters", "Contact", "Financing", "Free Estimate", "roof repair"], ["Storm Damage Restoration", "Why choose us?", "Call (405) 223-7699 today", "Commercial Roofing"]);
  assert.deepEqual(s, ["Roof Replacement", "Roof Repair", "Gutters", "Storm Damage Restoration", "Commercial Roofing"]);
  assert.deepEqual(extractServices(["Home", "Blog"], ["Welcome!"]), [], "nothing invented when the site lists nothing");
});

test("build show: tone notes are checkable observations, empty on thin copy", () => {
  const casual = "Hey folks! We've got your back. We fix roofs fast. You call, we show up. No stress, no hassle. We're honest and we're local! You'll love it. We've done this for years. Call us today!";
  const notes = toneNotesFromText(casual + " " + casual);
  assert.ok(notes.includes('Speaks as "we"')); assert.ok(notes.includes("Short sentences")); assert.ok(notes.includes("Uses exclamation points"));
  assert.deepEqual(toneNotesFromText("Too short."), []);
  const formal = "Our organization delivers comprehensive, industry-leading roofing solutions to commercial stakeholders throughout the region, leveraging decades of combined experience to ensure every deliverable meets the highest standard of quality and compliance. ".repeat(6);
  assert.ok(toneNotesFromText(formal).some((n) => /Corporate|Long/.test(n)));
});

test("build show: socials one per network, share links ignored; offer line from meta or heading; City, ST split; slugs", () => {
  const soc = extractSocials(["https://www.facebook.com/limitlessroofing", "https://www.facebook.com/sharer/sharer.php?u=x", "https://instagram.com/limitless_okc/", "https://www.facebook.com/other"]);
  assert.deepEqual(soc, { facebook: "https://www.facebook.com/limitlessroofing", instagram: "https://instagram.com/limitless_okc" });
  assert.equal(offerLineFrom('<meta property="og:description" content="Roof replacement in OKC with a 48-hour quote and a 10-year workmanship warranty.">', []), "Roof replacement in OKC with a 48-hour quote and a 10-year workmanship warranty.");
  assert.equal(offerLineFrom("", ["Hi", "This site uses cookies to improve your experience and we hope you enjoy it"]), null);
  assert.deepEqual(splitMarket("Oklahoma City, OK"), { city: "Oklahoma City", state: "OK" }); assert.deepEqual(splitMarket(null), { city: null, state: null });
  assert.equal(slugify("Limitless Roofing & Construction, LLC"), "limitless-roofing-and-construction-llc");
});

test("verification: resend cooldown 60s, max 3 resends; pending cookie is signed and tamper-proof", () => {
  const now = Date.parse("2026-10-11T22:00:00Z");
  assert.deepEqual(resendDecision([{ created_at: "2026-10-11T21:59:30Z" }], now), { ok: false, reason: "cooldown", retryInSec: 30 });
  assert.deepEqual(resendDecision([{ created_at: "2026-10-11T21:58:00Z" }], now), { ok: true });
  assert.deepEqual(resendDecision(Array.from({ length: MAX_RESENDS + 1 }, () => ({ created_at: "2026-10-11T21:00:00Z" })), now), { ok: false, reason: "max_resends" });
  assert.equal(RESEND_COOLDOWN_SEC, 60);
  const tok = signPending({ userId: "u1", email: "a@b.co", businessId: "b1" });
  assert.deepEqual(readPending(tok), { userId: "u1", email: "a@b.co", businessId: "b1" });
  assert.equal(readPending(tok.slice(0, -2) + "xx"), null); assert.equal(readPending("garbage"), null);
});

test("profile review: business name, your name, phone and offer line are required; socials/services sanitized", () => {
  const base = { businessName: "Limitless Roofing", contactName: "Roman Royce", website: "https://limitlessroofingokc.com", domain: "limitlessroofingokc.com", phone: "(405) 223-7699", offerLine: "Roof replacement with a 48-hour quote.", services: ["Roof Repair", "Roof Repair", " "], socials: { facebook: "https://facebook.com/x", bad: "javascript:alert(1)" }, state: "ok", category: "roofing" };
  const ok = parseDemoProfile(base);
  assert.ok("profile" in ok); if ("profile" in ok) { assert.deepEqual(ok.profile.services, ["Roof Repair"]); assert.deepEqual(ok.profile.socials, { facebook: "https://facebook.com/x" }); assert.equal(ok.profile.state, "OK"); }
  assert.deepEqual(parseDemoProfile({ ...base, phone: "555" }), { error: "Enter a phone number with at least 10 digits." });
  assert.match((parseDemoProfile({ ...base, offerLine: "short" }) as { error: string }).error, /one-line offer/);
  assert.match((parseDemoProfile({ ...base, contactName: "" }) as { error: string }).error, /your name/);
});

test("build show (live defects 2026-10-11): taglines, widget text and the business name are not services; the niche is a vertical word", () => {
  const s = extractServices(["Limitless Roofing Oklahoma City LLC", "Residential Roofing", "Roof Inspections"], ["No Roof Beyond Our Reach", "Checking OKC roof inspection conditions…", "Complete Roofing Solutions", "Limitless Roofing OKC — Storm Repair"], "Limitless Roofing OKC LLC");
  assert.deepEqual(s, ["Residential Roofing", "Roof Inspections", "Complete Roofing Solutions"]);
  assert.equal(verticalFrom("Limitless Roofing OKC LLC — Oklahoma City"), "roofing");
  assert.equal(verticalFrom(null, "Family dentist in Austin"), "dental");
  assert.equal(verticalFrom("Welcome to our homepage"), null);
});

test("niche classifier (etmhere.com root cause 2026-10-11): scored across weighted signals, boilerplate 'legal' never makes a law firm, community beats education, secondary tags surface", () => {
  const etm = classifyNiche([
    { text: "Escape The Matrix | Community, Education, Network", weight: 4 },
    { text: "ESCAPE THE MATRIX. · Plan. Build. Scale. Repeat. · Community · Inner Circle · SFB Access", weight: 2 },
    { text: "Join a private community. Free education and skills. Discord access, inner circle, network with people who build. Learn trading, content, business. Legal · Terms · Privacy", weight: 1 },
  ]);
  assert.equal(etm.primary, "community"); assert.ok(etm.tags.includes("education"), JSON.stringify(etm)); assert.ok(!("law firm" in etm.scores), "bare 'Legal' footer link is not a law firm");
  const roof = classifyNiche([{ text: "Limitless Roofing OKC LLC — Oklahoma City", weight: 4 }, { text: "Residential Roofing · Roof Repair · Gutters · Legal", weight: 2 }]);
  assert.equal(roof.primary, "roofing");
  assert.equal(classifyNiche([{ text: "Welcome to our homepage", weight: 4 }]).primary, null, "nothing invented below the minimum score");
  assert.equal(verticalFrom("Family dentist in Austin"), "dental");
  const law = classifyNiche([{ text: "Smith & Co — Personal Injury Attorneys", weight: 4 }]); assert.equal(law.primary, "law firm");
});
