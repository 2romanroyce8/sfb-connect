import { test } from "node:test";
import assert from "node:assert/strict";
import { isPrivateIp, normalizeUrl, AuditFetchError } from "../../lib/mk/safeFetch";
import { auditHtml, summarize } from "../../lib/mk/audit";

test("SSRF guard: private, loopback, link-local, metadata and CGNAT addresses are blocked; public ones are not", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.5", "172.31.255.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1", "not-an-ip"]) assert.equal(isPrivateIp(ip), true, ip);
  for (const ip of ["8.8.8.8", "1.1.1.1", "172.32.0.1", "93.184.216.34", "2606:4700:4700::1111"]) assert.equal(isPrivateIp(ip), false, ip);
});
test("URL rules: scheme, credentials, ports and bare hosts", () => {
  assert.equal(normalizeUrl("example.com").toString(), "https://example.com/");
  for (const bad of ["ftp://example.com", "https://user:pw@example.com", "https://example.com:8080", "http://localhost", "http://127.0.0.1", "javascript:alert(1)", ""]) assert.throws(() => normalizeUrl(bad), AuditFetchError, bad);
});
const GOOD = `<!doctype html><html lang="en"><head><title>Summit Roofing | Roof repair in Orlando</title><meta name="description" content="Summit Roofing repairs and replaces roofs across Orlando. Free inspections, storm damage help, and honest quotes for homeowners."><meta name="viewport" content="width=device-width"><link rel="canonical" href="https://x.com/"><script type="application/ld+json">{"@type":"RoofingContractor"}</script></head><body><h1>Roofing in Orlando</h1><h2>Services</h2><a href="tel:+14075550100">Call</a><a href="mailto:a@b.co">Email</a><img src="a.jpg" alt="roof"></body></html>`;
test("audit: a well-built page passes every check, with evidence", () => {
  const c = auditHtml(GOOD, "https://x.com/"); const s = summarize(c);
  assert.equal(s.fail, 0); assert.equal(s.warn, 0); assert.ok(c.every((x) => x.evidence.length > 5));
});
test("audit: a poor page fails and warns where it should, and never invents findings", () => {
  const c = auditHtml("<html><body><p>Call 407-555-0100</p><img src='a.jpg'><img src='b.jpg'></body></html>", "http://x.com/"); const by = Object.fromEntries(c.map((x) => [x.id, x.result]));
  assert.equal(by.https, "fail"); assert.equal(by.title, "fail"); assert.equal(by.description, "fail"); assert.equal(by.viewport, "fail"); assert.equal(by.h1, "fail"); assert.equal(by.schema, "warn"); assert.equal(by.contact, "warn"); assert.equal(by.alt, "fail"); assert.equal(by.lang, "warn");
});
