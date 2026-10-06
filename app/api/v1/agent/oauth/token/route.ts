import { NextResponse, type NextRequest } from "next/server";
import { consumeAuthCode, issueTokenPair, rotateRefreshToken, getAuthorization, rateLimit, audit } from "@/lib/agent/store";
import { verifyPkce } from "@/lib/agent/crypto";
import { oauthError, authenticateClient, readForm, canonicalRedirectUri } from "@/lib/agent/oauth";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await rateLimit(`token:${ip}:1m`, 60, 60);
  if (!rl.allowed) return oauthError(429, "too_many_requests", "Token endpoint rate limit reached.");
  const form = await readForm(req);
  const auth = await authenticateClient(req, form);
  if ("error" in auth) return auth.error;
  const grant = form.get("grant_type");

  if (grant === "authorization_code") {
    const code = form.get("code") ?? ""; const verifier = form.get("code_verifier") ?? "";
    if (!code || !verifier) return oauthError(400, "invalid_request", "code and code_verifier are required.");
    const row = await consumeAuthCode(code);
    if (!row) return oauthError(400, "invalid_grant", "Authorization code is invalid, expired or already used.");
    const authz = await getAuthorization(row.authorization_id);
    if (!authz || authz.status !== "active" || authz.client_id !== auth.client.client_id) return oauthError(400, "invalid_grant", "Authorization code does not belong to this client.");
    if (form.get("redirect_uri") && canonicalRedirectUri(form.get("redirect_uri")!) !== canonicalRedirectUri(row.redirect_uri)) return oauthError(400, "invalid_grant", "redirect_uri mismatch.");
    if (!verifyPkce(verifier, row.code_challenge, row.code_challenge_method)) {
      await audit({ authorizationId: authz.id, userId: authz.user_id, clientId: authz.client_id, accessMethod: "oauth", action: "token_pkce_failed", result: "denied" });
      return oauthError(400, "invalid_grant", "PKCE verification failed.");
    }
    const pair = await issueTokenPair(authz.id);
    await audit({ authorizationId: authz.id, userId: authz.user_id, clientId: authz.client_id, accessMethod: "oauth", action: "token_issued", result: "success", detail: { grant: "authorization_code" } });
    return NextResponse.json({ ...pair, token_type: "Bearer", scope: authz.scopes.join(" ") }, { headers: { "Cache-Control": "no-store", Pragma: "no-cache" } });
  }

  if (grant === "refresh_token") {
    const rt = form.get("refresh_token") ?? "";
    if (!rt) return oauthError(400, "invalid_request", "refresh_token is required.");
    const rotated = await rotateRefreshToken(rt);
    if (!rotated) return oauthError(400, "invalid_grant", "Refresh token is invalid or expired.");
    if ("reuse" in rotated) {
      await audit({ authorizationId: rotated.authorizationId, userId: null, clientId: auth.client.client_id, accessMethod: "oauth", action: "refresh_token_reuse", result: "denied", detail: { note: "authorization revoked" } });
      return oauthError(400, "invalid_grant", "Refresh token reuse detected; the authorization has been revoked.");
    }
    const authz = await getAuthorization(rotated.authorizationId);
    if (!authz || authz.status !== "active" || authz.client_id !== auth.client.client_id) return oauthError(400, "invalid_grant", "Authorization is no longer active.");
    const pair = await issueTokenPair(authz.id);
    await audit({ authorizationId: authz.id, userId: authz.user_id, clientId: authz.client_id, accessMethod: "oauth", action: "token_refreshed", result: "success" });
    return NextResponse.json({ ...pair, token_type: "Bearer", scope: authz.scopes.join(" ") }, { headers: { "Cache-Control": "no-store", Pragma: "no-cache" } });
  }
  return oauthError(400, "unsupported_grant_type", "Use authorization_code or refresh_token.");
}
