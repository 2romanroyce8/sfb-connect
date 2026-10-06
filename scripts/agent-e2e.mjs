#!/usr/bin/env node
// End-to-end OAuth client for the SFB Connect agent layer.
// Usage:
//   node scripts/agent-e2e.mjs register        -> registers a client, prints authorize URL (state saved to /tmp/sfb-agent-e2e.json)
//   node scripts/agent-e2e.mjs exchange <code> -> exchanges the code (PKCE) for tokens
//   node scripts/agent-e2e.mjs mcp             -> tools/list + tools/call against real data
//   node scripts/agent-e2e.mjs security        -> negative tests (no/invalid/expired token, scope, foreign ids, writes)
//   node scripts/agent-e2e.mjs refresh         -> rotates the refresh token, then proves reuse is detected
import fs from "node:fs";
import crypto from "node:crypto";

const BASE = process.env.SFB_BASE ?? "https://www.sfbconnect.com";
const STATE_FILE = "/tmp/sfb-agent-e2e.json";
const REDIRECT = process.env.SFB_REDIRECT ?? "http://127.0.0.1:53111/callback";
const load = () => (fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) : {});
const save = (s) => fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
const log = (...a) => console.log(...a);
const j = async (res) => { const t = await res.text(); try { return JSON.parse(t); } catch { return t; } };

async function register() {
  const meta = await (await fetch(`${BASE}/.well-known/oauth-authorization-server`)).json();
  log("AS metadata:", meta.issuer, meta.authorization_endpoint ? "ok" : "MISSING");
  const prm = await (await fetch(`${BASE}/.well-known/oauth-protected-resource`)).json();
  log("PRM resource:", prm.resource);
  const reg = await fetch(meta.registration_endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ client_name: "E2E Test Agent", redirect_uris: [REDIRECT], token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"] }) });
  const client = await j(reg);
  log("DCR status", reg.status, client.client_id);
  const verifier = crypto.randomBytes(48).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  const state = crypto.randomBytes(8).toString("hex");
  const url = new URL(meta.authorization_endpoint);
  Object.entries({ response_type: "code", client_id: client.client_id, redirect_uri: REDIRECT, scope: "sfb:team:read sfb:leads:read sfb:pipeline:read sfb:research:read sfb:audit:read sfb:ai_presence:read sfb:browser sfb:leads:write sfb:research:start", state, code_challenge: challenge, code_challenge_method: "S256", resource: prm.resource }).forEach(([k, v]) => url.searchParams.set(k, v));
  save({ meta, client, verifier, state });
  log("\nAUTHORIZE URL:\n" + url.toString());
}

async function exchange(code, stateFromCb) {
  const s = load();
  if (stateFromCb && stateFromCb !== s.state) throw new Error(`state mismatch: ${stateFromCb} != ${s.state}`);
  const res = await fetch(s.meta.token_endpoint, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: REDIRECT, client_id: s.client.client_id, code_verifier: s.verifier }) });
  const tok = await j(res);
  log("token status", res.status, { scope: tok.scope, expires_in: tok.expires_in, token_type: tok.token_type, has_refresh: !!tok.refresh_token });
  if (res.ok) { s.tokens = tok; save(s); }
  // replay must fail
  const replay = await fetch(s.meta.token_endpoint, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: REDIRECT, client_id: s.client.client_id, code_verifier: s.verifier }) });
  log("code replay ->", replay.status, (await j(replay)).error);
}

async function rpc(token, method, params, id = 1) {
  const res = await fetch(`${BASE}/api/v1/agent/mcp`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}`, "mcp-protocol-version": "2025-06-18" }, body: JSON.stringify({ jsonrpc: "2.0", id, method, params }) });
  return { status: res.status, body: await j(res), www: res.headers.get("www-authenticate") };
}

async function mcp() {
  const s = load(); const t = s.tokens.access_token;
  const init = await rpc(t, "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "e2e", version: "1" } });
  log("initialize", init.status, init.body.result?.serverInfo, "\n ", init.body.result?.instructions);
  const list = await rpc(t, "tools/list", {});
  log("tools/list", list.status, list.body.result?.tools.map((x) => x.name));
  const call = async (name, args) => { const r = await rpc(t, "tools/call", { name, arguments: args }); const sc = r.body.result?.structuredContent; log(`\n${name}`, r.status, r.body.result?.isError ? r.body.result.content[0].text : JSON.stringify(sc).slice(0, 700)); return sc; };
  await call("get_sfb_workspace", {});
  const team = await call("get_sfb_team", {});
  const leads = await call("search_sfb_leads", { limit: 5 });
  await call("get_sfb_pipeline", { limit_per_stage: 3 });
  const biz = await call("search_sfb_businesses", { limit: 5 });
  if (biz?.businesses?.[0]) { await call("get_sfb_business_research", { research_id: biz.businesses[0].id }); await call("get_sfb_research_sources", { research_id: biz.businesses[0].id }); }
  await call("get_sfb_research_status", { limit: 5 });
  if (leads?.leads?.[0]) { await call("get_sfb_lead", { lead_id: leads.leads[0].id }); await call("get_sfb_business_audit", { lead_id: leads.leads[0].id }); }
  if (team?.members?.[0]) await call("get_sfb_team_member", { member_id: team.members[0].id });
  const bs = await call("open_sfb_dashboard", { path: "/team/research" });
  if (bs?.url) { s.browserUrl = bs.url; save(s); log("\nBROWSER HANDOFF URL (2 min, single use):\n" + bs.url); }
  const rest = await fetch(`${BASE}/api/v1/agent/me`, { headers: { authorization: `Bearer ${t}` } });
  log("\nREST /me", rest.status, Object.keys(await j(rest)));
}

async function security() {
  const s = load(); const t = s.tokens.access_token;
  const show = (label, r) => log(label.padEnd(44), r.status, typeof r.body === "object" ? (r.body.error ?? r.body.result?.content?.[0]?.text ?? "") : "", r.www ?? "");
  // 1 no token
  show("no token", await rpc("", "tools/list", {}));
  // 2 garbage token
  show("invalid token", await rpc("sfba_not_a_real_token", "tools/list", {}));
  // 3 unknown tool
  show("unknown tool", await rpc(t, "tools/call", { name: "delete_everything", arguments: {} }));
  // 4 foreign / random ids -> 404 under RLS, never data
  show("random lead id", await rpc(t, "tools/call", { name: "get_sfb_lead", arguments: { lead_id: crypto.randomUUID() } }));
  show("random research id", await rpc(t, "tools/call", { name: "get_sfb_business_research", arguments: { research_id: crypto.randomUUID() } }));
  show("random business id", await rpc(t, "tools/call", { name: "get_sfb_ai_presence", arguments: { business_id: crypto.randomUUID() } }));
  show("sql-ish id", await rpc(t, "tools/call", { name: "get_sfb_lead", arguments: { lead_id: "' or 1=1 --" } }));
  // 5 writes: no write tool exists; REST write attempt to team API with bearer must be refused (bearer is not a cookie session)
  const w = await fetch(`${BASE}/api/team/leads/00000000-0000-0000-0000-000000000000`, { method: "PATCH", headers: { authorization: `Bearer ${t}`, "content-type": "application/json" }, body: "{}" });
  log("bearer -> PATCH /api/team/leads".padEnd(44), w.status);
  // 6 write scopes refused at negotiation (granted scope string)
  log("granted scopes".padEnd(44), s.tokens.scope, "\n   contains write scope?", /write|start|run/.test(s.tokens.scope));
  // 7 token endpoint: wrong verifier on a bogus code
  const bad = await fetch(s.meta.token_endpoint, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", code: "sfbac_bogus", redirect_uri: REDIRECT, client_id: s.client.client_id, code_verifier: s.verifier }) });
  log("bogus code".padEnd(44), bad.status, (await j(bad)).error);
  // 8 authorize with unregistered redirect
  const az = await fetch(`${s.meta.authorization_endpoint}?response_type=code&client_id=${s.client.client_id}&redirect_uri=https://evil.example.com/cb&code_challenge=x&code_challenge_method=S256`, { redirect: "manual" });
  log("authorize w/ evil redirect".padEnd(44), az.status, (await j(az)).error);
  // 9 discovery challenge on bare GET
  const g = await fetch(`${BASE}/api/v1/agent/mcp`); log("bare GET /mcp".padEnd(44), g.status, g.headers.get("www-authenticate"));
}

async function refresh() {
  const s = load();
  const body = (rt) => new URLSearchParams({ grant_type: "refresh_token", refresh_token: rt, client_id: s.client.client_id });
  const old = s.tokens.refresh_token;
  const r1 = await fetch(s.meta.token_endpoint, { method: "POST", body: body(old) }); const t1 = await j(r1);
  log("refresh #1", r1.status, !!t1.access_token);
  if (r1.ok) { s.tokens = t1; save(s); }
  const r2 = await fetch(s.meta.token_endpoint, { method: "POST", body: body(old) }); const t2 = await j(r2);
  log("reuse of rotated token", r2.status, t2.error, "-", t2.error_description);
  const after = await rpc(s.tokens.access_token, "tools/list", {});
  log("new access token after reuse detection ->", after.status, after.body.error ?? "ok");
}

const [cmd, a, b] = process.argv.slice(2);
({ register, exchange: () => exchange(a, b), mcp, security, refresh })[cmd]().catch((e) => { console.error(e); process.exit(1); });
