import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeHeaderValue } from "../../lib/integrations/gmail";

test("Gmail headers: ASCII subjects pass through; non-ASCII (em dash, curly quotes) become RFC 2047 encoded-words", () => {
  assert.equal(encodeHeaderValue("Quick question about Rent Solutions"), "Quick question about Rent Solutions");
  const enc = encodeHeaderValue("SFB Connect — Gmail switch verification");
  assert.match(enc, /^=\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=$/);
  assert.equal(Buffer.from(enc.slice(10, -2), "base64").toString("utf8"), "SFB Connect — Gmail switch verification");
  assert.match(encodeHeaderValue("“Hi” there"), /^=\?UTF-8\?B\?/);
});
