import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanAnswers, missingRequired, progress, looksLikeSecret, ALL_FIELDS } from "../../lib/agency/onboarding";
import { newInviteToken, hashInviteToken, inviteProblem } from "../../lib/agency/invite";

test("answers: unknown keys dropped, values trimmed and capped, non-strings ignored", () => {
  const a = cleanAnswers({ legal_name: "  Acme LLC  ", evil: "x", hours: 5, services: "y".repeat(5000), notes: "" });
  assert.deepEqual(Object.keys(a).sort(), ["legal_name", "services"]); assert.equal(a.legal_name, "Acme LLC"); assert.equal(a.services.length, ALL_FIELDS.find((f) => f.key === "services")!.max);
  assert.deepEqual(cleanAnswers(null), {}); assert.deepEqual(cleanAnswers("str"), {});
});
test("required fields and progress are computed from the same definition", () => {
  assert.ok(missingRequired({}).length >= 4); assert.equal(missingRequired(Object.fromEntries(ALL_FIELDS.filter((f) => f.required).map((f) => [f.key, "x"]))).length, 0);
  const p = progress({ legal_name: "x" }); assert.equal(p.done, 1); assert.ok(p.total >= 4);
});
test("credential-looking notes are flagged", () => {
  assert.equal(looksLikeSecret("our password: hunter22abc"), true); assert.equal(looksLikeSecret("api_key = abcd1234"), true); assert.equal(looksLikeSecret("sk_live_abcdefgh12345"), true);
  assert.equal(looksLikeSecret("We open at 8 and close at 5. Call the owner for anything urgent."), false);
});
test("invite tokens are random, hashed, and only the right email can use an unexpired unused invite", () => {
  const a = newInviteToken(), b = newInviteToken(); assert.notEqual(a, b); assert.match(a, /^sfbi_/); assert.notEqual(hashInviteToken(a), a); assert.equal(hashInviteToken(a).length, 64);
  const future = new Date(Date.now() + 1e6).toISOString(), past = new Date(Date.now() - 1e6).toISOString();
  assert.equal(inviteProblem({ expires_at: future, accepted_at: null, email: "Pat@X.com" }, "pat@x.com"), null);
  assert.ok(inviteProblem(null, "a@b.co")); assert.ok(inviteProblem({ expires_at: past, accepted_at: null, email: "a@b.co" }, "a@b.co"));
  assert.ok(inviteProblem({ expires_at: future, accepted_at: past, email: "a@b.co" }, "a@b.co")); assert.ok(inviteProblem({ expires_at: future, accepted_at: null, email: "a@b.co" }, "other@b.co")); assert.ok(inviteProblem({ expires_at: future, accepted_at: null, email: "a@b.co" }, null));
});
