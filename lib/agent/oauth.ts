import { NextResponse, type NextRequest } from "next/server";
import { getClient, type AgentClient } from "./store";
import { sha256, timingSafeEqualStr } from "./crypto";
import { appOrigin } from "./auth";
import { GRANTABLE_SCOPES } from "./scopes";

export const CONSENT_PATH = "/team/authorize-agent";

export function oauthError(status: number, error: string, description: string) {
  return NextResponse.json({ error, error_description: description }, { status, headers: { "Cache-Control": "no-store", Pragma: "no-cache" } });
}

export function authorizationServerMetadata(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/api/v1/agent/oauth/authorize`,
    token_endpoint: `${origin}/api/v1/agent/oauth/token`,
    registration_endpoint: `${origin}/api/v1/agent/oauth/register`,
    revocation_endpoint: `${origin}/api/v1/agent/oauth/revoke`,
    scopes_supported: GRANTABLE_SCOPES,
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
    revocation_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
    code_challenge_methods_supported: ["S256"],
    service_documentation: `${origin}/api/v1/agent/me`,
  };
}
export function protectedResourceMetadata(origin: string) {
  return {
    resource: `${origin}/api/v1/agent/mcp`,
    authorization_servers: [origin],
    scopes_supported: GRANTABLE_SCOPES,
    bearer_methods_supported: ["header"],
    resource_name: "SFB Connect Agent API",
  };
}

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);
/** Loopback redirect URIs (RFC 8252 §7.3) are canonicalised to 127.0.0.1 so
 * the three loopback spellings compare equal. Needed in practice because
 * the hosting runtime rewrites "127.0.0.1" to "localhost" inside query
 * values before the handler sees them. Non-loopback URIs are untouched. */
export function canonicalRedirectUri(uri: string): string {
  try { const u = new URL(uri); if (LOOPBACK_HOSTS.has(u.hostname)) { u.hostname = "127.0.0.1"; return u.toString(); } return uri; } catch { return uri; }
}

/** True for 127.0.0.1 / localhost / [::1] redirect targets. */
export function isLoopbackUri(uri: string): boolean {
  try { return LOOPBACK_HOSTS.has(new URL(uri).hostname); } catch { return false; }
}

/** Exact-match redirect URI validation; loopback URIs may vary in port. */
export function redirectUriAllowed(client: AgentClient, uri: string): boolean {
  let u: URL;
  try { u = new URL(canonicalRedirectUri(uri)); } catch { return false; }
  const registered = client.redirect_uris.map(canonicalRedirectUri);
  if (registered.includes(u.toString()) || registered.includes(canonicalRedirectUri(uri))) return true;
  if (u.hostname === "127.0.0.1") {
    return registered.some((r) => { try { const ru = new URL(r); return ru.protocol === u.protocol && ru.hostname === u.hostname && ru.pathname === u.pathname; } catch { return false; } });
  }
  return false;
}

/** Authenticates the client at the token/revocation endpoint. Public clients: identity only. */
export async function authenticateClient(req: NextRequest, form: URLSearchParams): Promise<{ client: AgentClient } | { error: NextResponse }> {
  let clientId = form.get("client_id") ?? "";
  let secret = form.get("client_secret") ?? "";
  const basic = req.headers.get("authorization");
  if (basic?.startsWith("Basic ")) {
    try { const [id, sec = ""] = Buffer.from(basic.slice(6), "base64").toString("utf8").split(":"); clientId = decodeURIComponent(id); secret = decodeURIComponent(sec); } catch { /* fall through */ }
  }
  if (!clientId) return { error: oauthError(401, "invalid_client", "client_id is required.") };
  const client = await getClient(clientId);
  if (!client) return { error: oauthError(401, "invalid_client", "Unknown client.") };
  if (!client.is_public) {
    if (!secret || !client.client_secret_hash || !timingSafeEqualStr(sha256(secret), client.client_secret_hash)) return { error: oauthError(401, "invalid_client", "Client authentication failed.") };
  }
  return { client };
}

export async function readForm(req: NextRequest): Promise<URLSearchParams> {
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) { const j = (await req.json().catch(() => ({}))) as Record<string, unknown>; return new URLSearchParams(Object.entries(j).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])); }
  return new URLSearchParams(await req.text());
}

export function originOf(req: NextRequest) { return appOrigin(req); }
