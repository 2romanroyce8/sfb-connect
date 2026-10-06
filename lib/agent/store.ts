import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { sha256, randomToken } from "./crypto";

// All agent-layer rows are service-role only (RLS, no anon/authenticated
// policies except the owner's read of their own authorizations/audit).
export const svc = (): SupabaseClient => createSupabaseServiceClient();

export const ACCESS_TOKEN_TTL_SEC = 60 * 60; // 1h
export const REFRESH_TOKEN_TTL_SEC = 60 * 60 * 24 * 30; // 30d, rotated on every use
export const AUTH_CODE_TTL_SEC = 5 * 60;
export const HANDOFF_TTL_SEC = 2 * 60;

export type AgentClient = { client_id: string; client_name: string; redirect_uris: string[]; is_public: boolean; client_secret_hash: string | null };
export type AgentAuthorization = { id: string; user_id: string; client_id: string; workspace_label: string; scopes: string[]; status: "active" | "revoked"; delegated_refresh_enc: string | null; delegated_access_enc: string | null; delegated_access_expires_at: string | null; created_at: string; revoked_at: string | null; last_used_at: string | null };

export async function getClient(clientId: string): Promise<AgentClient | null> {
  const { data } = await svc().from("agent_clients").select("client_id, client_name, redirect_uris, is_public, client_secret_hash").eq("client_id", clientId).maybeSingle();
  return (data as AgentClient | null) ?? null;
}

export async function registerClient(input: { client_name: string; redirect_uris: string[]; token_endpoint_auth_method?: string; metadata?: Record<string, unknown> }): Promise<{ client: AgentClient; client_secret: string | null }> {
  const clientId = randomToken("sfbc", 12);
  const isPublic = (input.token_endpoint_auth_method ?? "none") === "none";
  const secret = isPublic ? null : randomToken("sfbs", 32);
  const row = { client_id: clientId, client_name: input.client_name.slice(0, 120), redirect_uris: input.redirect_uris, is_public: isPublic, client_secret_hash: secret ? sha256(secret) : null, registered_by: "dynamic", metadata: input.metadata ?? {} };
  const { error } = await svc().from("agent_clients").insert(row);
  if (error) throw new Error(`client registration failed: ${error.message}`);
  return { client: { client_id: clientId, client_name: row.client_name, redirect_uris: row.redirect_uris, is_public: isPublic, client_secret_hash: row.client_secret_hash }, client_secret: secret };
}

export async function createAuthorization(input: { userId: string; clientId: string; scopes: string[]; workspaceLabel: string; delegatedRefreshEnc: string | null; delegatedAccessEnc: string | null; delegatedAccessExpiresAt: string | null }): Promise<AgentAuthorization> {
  const { data, error } = await svc().from("agent_authorizations").insert({
    user_id: input.userId, client_id: input.clientId, scopes: input.scopes, workspace_label: input.workspaceLabel,
    delegated_refresh_enc: input.delegatedRefreshEnc, delegated_access_enc: input.delegatedAccessEnc, delegated_access_expires_at: input.delegatedAccessExpiresAt,
  }).select("*").single();
  if (error || !data) throw new Error(`authorization insert failed: ${error?.message}`);
  return data as AgentAuthorization;
}

export async function getAuthorization(id: string): Promise<AgentAuthorization | null> {
  const { data } = await svc().from("agent_authorizations").select("*").eq("id", id).maybeSingle();
  return (data as AgentAuthorization | null) ?? null;
}

export async function issueAuthCode(input: { authorizationId: string; redirectUri: string; codeChallenge: string; codeChallengeMethod: string; resource: string | null }): Promise<string> {
  const code = randomToken("sfbac", 32);
  const { error } = await svc().from("agent_auth_codes").insert({
    code_hash: sha256(code), authorization_id: input.authorizationId, redirect_uri: input.redirectUri, code_challenge: input.codeChallenge, code_challenge_method: input.codeChallengeMethod, resource: input.resource,
    expires_at: new Date(Date.now() + AUTH_CODE_TTL_SEC * 1000).toISOString(),
  });
  if (error) throw new Error(`auth code insert failed: ${error.message}`);
  return code;
}

/** Single-use: marks the code used in the same statement that reads it. */
export async function consumeAuthCode(code: string) {
  const { data } = await svc().from("agent_auth_codes").update({ used_at: new Date().toISOString() }).eq("code_hash", sha256(code)).is("used_at", null).gt("expires_at", new Date().toISOString()).select("*").maybeSingle();
  return data as { authorization_id: string; redirect_uri: string; code_challenge: string; code_challenge_method: string; resource: string | null } | null;
}

export async function issueTokenPair(authorizationId: string): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const access = randomToken("sfba", 32);
  const refresh = randomToken("sfbr", 32);
  const now = Date.now();
  const { error } = await svc().from("agent_tokens").insert([
    { token_hash: sha256(access), authorization_id: authorizationId, kind: "access", expires_at: new Date(now + ACCESS_TOKEN_TTL_SEC * 1000).toISOString() },
    { token_hash: sha256(refresh), authorization_id: authorizationId, kind: "refresh", expires_at: new Date(now + REFRESH_TOKEN_TTL_SEC * 1000).toISOString() },
  ]);
  if (error) throw new Error(`token insert failed: ${error.message}`);
  return { access_token: access, refresh_token: refresh, expires_in: ACCESS_TOKEN_TTL_SEC };
}

/** Rotation: the presented refresh token is revoked and replaced atomically-enough
 * (update ... is null guards double use); a reused rotated token revokes the whole authorization. */
export async function rotateRefreshToken(refreshToken: string): Promise<{ authorizationId: string } | { reuse: true; authorizationId: string } | null> {
  const s = svc();
  const hash = sha256(refreshToken);
  const { data: row } = await s.from("agent_tokens").select("authorization_id, revoked_at, expires_at, replaced_by_hash").eq("token_hash", hash).eq("kind", "refresh").maybeSingle();
  if (!row) return null;
  if (row.revoked_at || row.replaced_by_hash) {
    // Reuse of a rotated token = theft signal. Kill everything on this authorization.
    await revokeAuthorization(row.authorization_id, "refresh_token_reuse");
    return { reuse: true, authorizationId: row.authorization_id };
  }
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  const { data: updated } = await s.from("agent_tokens").update({ revoked_at: new Date().toISOString(), replaced_by_hash: "pending" }).eq("token_hash", hash).is("revoked_at", null).select("authorization_id").maybeSingle();
  if (!updated) return null;
  return { authorizationId: updated.authorization_id };
}

export async function lookupAccessToken(accessToken: string): Promise<{ authorization: AgentAuthorization } | { error: "invalid" | "expired" | "revoked" }> {
  const { data: row } = await svc().from("agent_tokens").select("authorization_id, expires_at, revoked_at").eq("token_hash", sha256(accessToken)).eq("kind", "access").maybeSingle();
  if (!row) return { error: "invalid" };
  if (row.revoked_at) return { error: "revoked" };
  if (new Date(row.expires_at).getTime() < Date.now()) return { error: "expired" };
  const auth = await getAuthorization(row.authorization_id);
  if (!auth || auth.status !== "active") return { error: "revoked" };
  return { authorization: auth };
}

export async function revokeAuthorization(id: string, reason: string) {
  const s = svc();
  const now = new Date().toISOString();
  await s.from("agent_authorizations").update({ status: "revoked", revoked_at: now, revoked_reason: reason }).eq("id", id);
  await s.from("agent_tokens").update({ revoked_at: now }).eq("authorization_id", id).is("revoked_at", null);
  await s.from("agent_browser_handoffs").update({ used_at: now }).eq("authorization_id", id).is("used_at", null);
}

export async function revokeByToken(token: string) {
  const { data } = await svc().from("agent_tokens").select("authorization_id").eq("token_hash", sha256(token)).maybeSingle();
  if (data) await revokeAuthorization(data.authorization_id, "client_revocation");
}

export async function touchAuthorization(id: string) {
  await svc().from("agent_authorizations").update({ last_used_at: new Date().toISOString() }).eq("id", id);
}

export async function issueBrowserHandoff(authorizationId: string): Promise<string> {
  const code = randomToken("sfbh", 32);
  const { error } = await svc().from("agent_browser_handoffs").insert({ code_hash: sha256(code), authorization_id: authorizationId, expires_at: new Date(Date.now() + HANDOFF_TTL_SEC * 1000).toISOString() });
  if (error) throw new Error(`handoff insert failed: ${error.message}`);
  return code;
}
export async function consumeBrowserHandoff(code: string): Promise<string | null> {
  const { data } = await svc().from("agent_browser_handoffs").update({ used_at: new Date().toISOString() }).eq("code_hash", sha256(code)).is("used_at", null).gt("expires_at", new Date().toISOString()).select("authorization_id").maybeSingle();
  return data?.authorization_id ?? null;
}

export type AuditInput = { authorizationId: string | null; userId: string | null; clientId: string | null; accessMethod: "api" | "mcp" | "browser" | "oauth"; action: string; resource?: string | null; scope?: string | null; result: "success" | "denied" | "error"; detail?: Record<string, unknown> };
/** Never logs tokens, cookies or secrets -- callers pass identifiers only. */
export async function audit(input: AuditInput) {
  try {
    await svc().from("agent_audit_log").insert({ authorization_id: input.authorizationId, user_id: input.userId, client_id: input.clientId, access_method: input.accessMethod, action: input.action, resource: input.resource ?? null, scope: input.scope ?? null, result: input.result, detail: input.detail ?? {} });
  } catch (e) { console.error("[agent-audit] write failed", e); }
}

/** Fixed-window counter per bucket (e.g. "auth:<id>:min"). Returns remaining. */
export async function rateLimit(bucketKey: string, limit: number, windowSec: number): Promise<{ allowed: boolean; remaining: number }> {
  const s = svc();
  const windowStart = new Date(Math.floor(Date.now() / (windowSec * 1000)) * windowSec * 1000).toISOString();
  const { data } = await s.from("agent_rate_limits").select("window_start, count").eq("bucket_key", bucketKey).maybeSingle();
  if (!data || data.window_start !== windowStart) {
    await s.from("agent_rate_limits").upsert({ bucket_key: bucketKey, window_start: windowStart, count: 1 });
    return { allowed: true, remaining: limit - 1 };
  }
  if (data.count >= limit) return { allowed: false, remaining: 0 };
  await s.from("agent_rate_limits").update({ count: data.count + 1 }).eq("bucket_key", bucketKey);
  return { allowed: true, remaining: limit - data.count - 1 };
}
