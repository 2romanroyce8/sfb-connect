import { test } from "node:test";
import assert from "node:assert/strict";
import { signPayload, verifySignature } from "../../lib/integrations/webhooks";
import { OAUTH_PROVIDERS, buildAuthorizeUrl, exchangeCode, redirectUriFor } from "../../lib/integrations/providers";

test("webhook signatures: valid for the exact body, rejected when tampered, replayed late, or malformed", () => {
  const sig = signPayload("whsec_abc", '{"a":1}', 1_700_000_000);
  assert.match(sig, /^t=1700000000,v1=[a-f0-9]{64}$/);
  const now = Math.floor(Date.now() / 1000);
  const fresh = signPayload("whsec_abc", '{"a":1}', now);
  assert.equal(verifySignature("whsec_abc", '{"a":1}', fresh), true);
  assert.equal(verifySignature("whsec_abc", '{"a":2}', fresh), false, "tampered body");
  assert.equal(verifySignature("whsec_other", '{"a":1}', fresh), false, "wrong secret");
  assert.equal(verifySignature("whsec_abc", '{"a":1}', sig), false, "stale timestamp");
  assert.equal(verifySignature("whsec_abc", '{"a":1}', "garbage"), false);
});

test("OAuth authorize URLs carry client id, exact redirect URI, state, scopes and provider extras", () => {
  const env = { GOOGLE_CLIENT_ID: "gid", GOOGLE_CLIENT_SECRET: "gs", SLACK_CLIENT_ID: "sid", SLACK_CLIENT_SECRET: "ss", NOTION_CLIENT_ID: "nid", NOTION_CLIENT_SECRET: "ns" };
  const u = new URL(buildAuthorizeUrl(OAUTH_PROVIDERS.gmail, "st4te", env));
  assert.equal(u.origin + u.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
  assert.equal(u.searchParams.get("client_id"), "gid");
  assert.equal(u.searchParams.get("redirect_uri"), redirectUriFor("gmail"));
  assert.ok(redirectUriFor("gmail").endsWith("/api/team/integrations/gmail/callback"));
  assert.equal(u.searchParams.get("state"), "st4te");
  assert.match(u.searchParams.get("scope")!, /gmail\.send/);
  assert.equal(u.searchParams.get("access_type"), "offline");
  const slack = new URL(buildAuthorizeUrl(OAUTH_PROVIDERS.slack, "x", env));
  assert.equal(slack.searchParams.get("scope"), "chat:write,channels:read,channels:join,incoming-webhook");
  const notion = new URL(buildAuthorizeUrl(OAUTH_PROVIDERS.notion, "x", env));
  assert.equal(notion.searchParams.get("owner"), "user");
  assert.equal(notion.searchParams.has("scope"), false);
});

test("token exchange: body-auth providers post form data; basic-auth providers send Authorization header; errors surface", async () => {
  const env = { GHL_CLIENT_ID: "cid", GHL_CLIENT_SECRET: "cs", NOTION_CLIENT_ID: "nid", NOTION_CLIENT_SECRET: "ns" };
  const seen: { url: string; init: RequestInit }[] = [];
  const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  const f = (async (url: string, init: RequestInit) => { seen.push({ url, init }); return url.includes("notion") ? ok({ access_token: "nt", workspace_name: "WS" }) : ok({ access_token: "at", refresh_token: "rt", expires_in: 3600, locationId: "L1" }); }) as unknown as typeof fetch;
  const ghl = await exchangeCode(OAUTH_PROVIDERS.gohighlevel, "code1", env, f);
  assert.equal(ghl.access_token, "at"); assert.equal(ghl.refresh_token, "rt"); assert.equal(ghl.raw.locationId, "L1");
  const body = String(seen[0].init.body);
  assert.match(body, /client_id=cid/); assert.match(body, /client_secret=cs/); assert.match(body, /user_type=Location/); assert.match(body, /grant_type=authorization_code/);
  const notion = await exchangeCode(OAUTH_PROVIDERS.notion, "code2", env, f);
  assert.equal(notion.access_token, "nt");
  const h = seen[1].init.headers as Record<string, string>;
  assert.equal(h.Authorization, `Basic ${Buffer.from("nid:ns").toString("base64")}`);
  assert.ok(!String(seen[1].init.body).includes("client_secret"), "basic-auth providers never put the secret in the body");
  const bad = (async () => new Response(JSON.stringify({ error: "invalid_grant", error_description: "Code expired" }), { status: 400 })) as unknown as typeof fetch;
  await assert.rejects(exchangeCode(OAUTH_PROVIDERS.gohighlevel, "x", env, bad), /Code expired/);
});

test("Gmail reuses the Google Calendar redirect URI when one is registered; other providers get their own", () => {
  assert.equal(redirectUriFor("gmail", { GOOGLE_OAUTH_REDIRECT_URI: "https://www.sfbconnect.com/api/team/integrations/google/callback" }), "https://www.sfbconnect.com/api/team/integrations/google/callback");
  assert.ok(redirectUriFor("slack", { GOOGLE_OAUTH_REDIRECT_URI: "https://x/y" }).endsWith("/api/team/integrations/slack/callback"));
  const u = new URL(buildAuthorizeUrl(OAUTH_PROVIDERS.gmail, "s", { GOOGLE_CLIENT_ID: "g", GOOGLE_CLIENT_SECRET: "s", GOOGLE_OAUTH_REDIRECT_URI: "https://www.sfbconnect.com/api/team/integrations/google/callback" }));
  assert.equal(u.searchParams.get("redirect_uri"), "https://www.sfbconnect.com/api/team/integrations/google/callback");
});

test("OAuth redirect URIs always use the www host, whatever NEXT_PUBLIC_APP_URL says", () => {
  for (const v of ["https://sfbconnect.com", "https://sfbconnect.com/", "https://www.sfbconnect.com", undefined]) {
    assert.equal(redirectUriFor("linkedin", { NEXT_PUBLIC_APP_URL: v }), "https://www.sfbconnect.com/api/team/integrations/linkedin/callback", String(v));
  }
});

test("client credentials are trimmed (pasted whitespace in Vercel must not break auth)", async () => {
  const env = { LINKEDIN_CLIENT_ID: " abc \n", LINKEDIN_CLIENT_SECRET: "sec \n" };
  assert.equal(new URL(buildAuthorizeUrl(OAUTH_PROVIDERS.linkedin, "s", env)).searchParams.get("client_id"), "abc");
  let body = "";
  const f = (async (_u: string, init: RequestInit) => { body = String(init.body); return new Response(JSON.stringify({ access_token: "t" }), { status: 200 }); }) as unknown as typeof fetch;
  await exchangeCode(OAUTH_PROVIDERS.linkedin, "c", env, f);
  assert.match(body, /client_secret=sec(&|$)/); assert.match(body, /client_id=abc(&|$)/);
});

import { redirectUriFor as rfor } from "../../lib/integrations/providers";
test("new providers: exact redirect URIs; TikTok uses client_key; QuickBooks posts a form with Basic auth", async () => {
  for (const k of ["outlook", "google_business_profile", "quickbooks", "hubspot", "tiktok"]) assert.equal(rfor(k, {}), `https://www.sfbconnect.com/api/team/integrations/${k}/callback`);
  const env = { TIKTOK_CLIENT_KEY: "tk", TIKTOK_CLIENT_SECRET: "ts", QUICKBOOKS_CLIENT_ID: "qid", QUICKBOOKS_CLIENT_SECRET: "qs", MICROSOFT_CLIENT_ID: "mid", MICROSOFT_CLIENT_SECRET: "ms" };
  const tt = new URL(buildAuthorizeUrl(OAUTH_PROVIDERS.tiktok, "st", env));
  assert.equal(tt.searchParams.get("client_key"), "tk"); assert.equal(tt.searchParams.has("client_id"), false); assert.equal(tt.searchParams.get("scope"), "user.info.basic");
  const ms = new URL(buildAuthorizeUrl(OAUTH_PROVIDERS.outlook, "st", env));
  assert.equal(ms.origin + ms.pathname, "https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
  assert.match(ms.searchParams.get("scope")!, /offline_access .*Calendars\.ReadWrite .*Mail\.Send/);
  const seen: { url: string; init: RequestInit }[] = [];
  const f = (async (url: string, init: RequestInit) => { seen.push({ url, init }); return new Response(JSON.stringify({ access_token: "a", refresh_token: "r", expires_in: 3600 }), { status: 200, headers: { "content-type": "application/json" } }); }) as unknown as typeof fetch;
  await exchangeCode(OAUTH_PROVIDERS.quickbooks, "c", env, f);
  const h = seen[0].init.headers as Record<string, string>;
  assert.equal(h.Authorization, `Basic ${Buffer.from("qid:qs").toString("base64")}`);
  assert.equal(h["Content-Type"], "application/x-www-form-urlencoded");
  assert.match(String(seen[0].init.body), /grant_type=authorization_code/); assert.ok(!String(seen[0].init.body).includes("client_secret"));
  await exchangeCode(OAUTH_PROVIDERS.tiktok, "c", env, f);
  assert.match(String(seen[1].init.body), /client_key=tk/); assert.ok(!String(seen[1].init.body).includes("client_id="));
});

import { handleVerification, whatsappVerifyToken, verifyMetaSignature } from "../../lib/integrations/whatsapp";
import crypto from "node:crypto";
test("WhatsApp: verify token derived or explicit; handshake echoes challenge only on a match; signature check", () => {
  const env = { WHATSAPP_PHONE_NUMBER_ID: "1", WHATSAPP_ACCESS_TOKEN: "tok" };
  const tok = whatsappVerifyToken(env)!;
  assert.match(tok, /^sfbwa_[a-f0-9]{32}$/);
  assert.equal(whatsappVerifyToken({ ...env, WHATSAPP_VERIFY_TOKEN: "mine" }), "mine");
  assert.equal(whatsappVerifyToken({}), null);
  assert.deepEqual(handleVerification(new URLSearchParams({ "hub.mode": "subscribe", "hub.verify_token": tok, "hub.challenge": "123" }), env), { ok: true, challenge: "123" });
  assert.equal(handleVerification(new URLSearchParams({ "hub.mode": "subscribe", "hub.verify_token": "wrong", "hub.challenge": "123" }), env).ok, false);
  assert.equal(handleVerification(new URLSearchParams({ "hub.mode": "subscribe", "hub.verify_token": tok, "hub.challenge": "1" }), {}).ok, false);
  const body = '{"entry":[]}'; const mac = crypto.createHmac("sha256", "appsecret").update(body).digest("hex");
  assert.equal(verifyMetaSignature(body, `sha256=${mac}`, { META_APP_SECRET: "appsecret" }), true);
  assert.equal(verifyMetaSignature(body, "sha256=00", { META_APP_SECRET: "appsecret" }), false);
  assert.equal(verifyMetaSignature(body, null, {}), null);
});
