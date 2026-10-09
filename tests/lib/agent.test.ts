import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { verifyPkce, sha256, randomToken } from "../../lib/agent/crypto";
import { negotiateScopes, GRANTABLE_SCOPES, isWriteScope } from "../../lib/agent/scopes";
import { isMutatingMethod } from "../../lib/agent/readOnly";
import { redirectUriAllowed, authorizationServerMetadata } from "../../lib/agent/oauth";
import { handleMcp } from "../../lib/agent/mcp";
import { TOOLS } from "../../lib/agent/tools";
import type { AgentContext } from "../../lib/agent/auth";

test("PKCE S256 verifies the matching verifier and rejects everything else", () => {
  const verifier = crypto.randomBytes(48).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  assert.equal(verifyPkce(verifier, challenge), true);
  assert.equal(verifyPkce(verifier + "x", challenge), false);
  assert.equal(verifyPkce(verifier, challenge, "plain"), false);
  assert.equal(verifyPkce("short", crypto.createHash("sha256").update("short").digest("base64url")), false);
});

test("tokens are opaque and only their hash is ever comparable", () => {
  const t = randomToken("sfba");
  assert.match(t, /^sfba_[A-Za-z0-9_-]{40,}$/);
  assert.equal(sha256(t), sha256(t));
  assert.notEqual(sha256(t), sha256(randomToken("sfba")));
});

test("scope negotiation grants only read scopes and refuses every write scope", () => {
  const { granted, refused } = negotiateScopes("sfb:leads:read sfb:leads:write sfb:research:start sfb:research:read bogus");
  assert.deepEqual(granted, ["sfb:workspace:read", "sfb:leads:read", "sfb:research:read"], "workspace:read (identity) is always included");
  assert.deepEqual(refused.sort(), ["bogus", "sfb:leads:write", "sfb:research:start"].sort());
  assert.ok(GRANTABLE_SCOPES.every((s) => !isWriteScope(s)));
  assert.ok(negotiateScopes(undefined).granted.length > 0, "empty request falls back to the default read set");
});

test("research:read is distinct from research:start (reading results never permits starting research)", () => {
  assert.equal(negotiateScopes("sfb:research:read").granted.includes("sfb:research:start" as never), false);
  assert.equal(isWriteScope("sfb:research:start"), true);
});

test("agent browser sessions: only safe HTTP methods pass", () => {
  for (const m of ["GET", "HEAD", "OPTIONS", "get"]) assert.equal(isMutatingMethod(m), false, m);
  for (const m of ["POST", "PATCH", "PUT", "DELETE"]) assert.equal(isMutatingMethod(m), true, m);
});

test("redirect URIs must match exactly except loopback ports", () => {
  const client = { client_id: "c", client_name: "c", is_public: true, client_secret_hash: null, redirect_uris: ["https://app.example.com/cb", "http://127.0.0.1/cb"] };
  assert.equal(redirectUriAllowed(client, "https://app.example.com/cb"), true);
  assert.equal(redirectUriAllowed(client, "https://app.example.com/cb?x=1"), false);
  assert.equal(redirectUriAllowed(client, "https://evil.example.com/cb"), false);
  assert.equal(redirectUriAllowed(client, "http://127.0.0.1:53211/cb"), true);
  assert.equal(redirectUriAllowed(client, "http://127.0.0.1:53211/other"), false);
  assert.equal(redirectUriAllowed(client, "http://localhost:53211/cb"), true, "loopback spellings are equivalent");
  assert.equal(redirectUriAllowed(client, "http://localhost/cb"), true);
});

test("authorization server metadata advertises PKCE-only code flow and read scopes", () => {
  const m = authorizationServerMetadata("https://www.sfbconnect.com");
  assert.deepEqual(m.code_challenge_methods_supported, ["S256"]);
  assert.deepEqual(m.response_types_supported, ["code"]);
  assert.ok(m.scopes_supported.every((s: string) => !isWriteScope(s)));
  assert.equal(m.token_endpoint, "https://www.sfbconnect.com/api/v1/agent/oauth/token");
});

function fakeCtx(scopes: string[]): AgentContext {
  return { authorization: { id: "a", user_id: "u", client_id: "test", workspace_label: "SFB Connect Team", scopes, status: "active", delegated_refresh_enc: null, delegated_access_enc: null, delegated_access_expires_at: null, created_at: "", revoked_at: null, last_used_at: null }, user: {} as never, scopes: new Set(scopes), clientId: "test", userId: "u" };
}
const req = { headers: new Headers(), nextUrl: new URL("https://www.sfbconnect.com/api/v1/agent/mcp") } as never;

test("MCP tools/list only lists tools whose scope was granted; every tool is read-only", async () => {
  const r = (await handleMcp(fakeCtx(["sfb:leads:read"]), { jsonrpc: "2.0", id: 1, method: "tools/list" }, req)) as { result: { tools: { name: string; annotations: { readOnlyHint: boolean } }[] } };
  const names = r.result.tools.map((t) => t.name).sort();
  assert.deepEqual(names, ["get_sfb_lead", "search_sfb_leads"]);
  assert.ok(r.result.tools.every((t) => t.annotations.readOnlyHint === true));
  assert.equal(TOOLS.some((t) => isWriteScope(t.scope)), false, "no tool requires a customer-data write scope");
  assert.ok(TOOLS.filter((t) => t.readOnly === false).every((t) => t.scope === "sfb:tasks"), "the only writing tools are task-queue tools");
});

test("MCP tools/call without the tool's scope is refused as a tool error, not executed", async () => {
  const r = (await handleMcp(fakeCtx(["sfb:leads:read"]), { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "get_sfb_team", arguments: {} } }, req)) as { result: { isError: boolean; content: { text: string }[] } };
  assert.equal(r.result.isError, true);
  assert.match(r.result.content[0].text, /insufficient_scope/);
});

test("MCP: initialize answers, unknown methods are -32601, notifications get no response", async () => {
  const init = (await handleMcp(fakeCtx([]), { jsonrpc: "2.0", id: 0, method: "initialize", params: {} }, req)) as { result: { protocolVersion: string } };
  assert.ok(init.result.protocolVersion);
  const unknown = (await handleMcp(fakeCtx([]), { jsonrpc: "2.0", id: 3, method: "resources/list" }, req)) as { error: { code: number } };
  assert.equal(unknown.error.code, -32601);
  assert.equal(await handleMcp(fakeCtx([]), { jsonrpc: "2.0", method: "notifications/initialized" }, req), null);
});
