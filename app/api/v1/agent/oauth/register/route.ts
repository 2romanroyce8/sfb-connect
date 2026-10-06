import { NextResponse, type NextRequest } from "next/server";
import { registerClient, rateLimit, audit } from "@/lib/agent/store";
import { oauthError, originOf } from "@/lib/agent/oauth";
import { GRANTABLE_SCOPES } from "@/lib/agent/scopes";
export const dynamic = "force-dynamic";

// RFC 7591 Dynamic Client Registration. Registration only names a client and
// its redirect URIs; it grants NO access -- a user must still authorize it on
// the consent screen. Rate-limited per IP to prevent table flooding.
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await rateLimit(`dcr:${ip}:1h`, 20, 3600);
  if (!rl.allowed) return oauthError(429, "too_many_requests", "Registration rate limit reached.");
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return oauthError(400, "invalid_client_metadata", "Body must be JSON.");
  const uris = Array.isArray(body.redirect_uris) ? body.redirect_uris.filter((u): u is string => typeof u === "string") : [];
  if (uris.length === 0) return oauthError(400, "invalid_redirect_uri", "At least one redirect_uri is required.");
  for (const u of uris) {
    let parsed: URL; try { parsed = new URL(u); } catch { return oauthError(400, "invalid_redirect_uri", `Not a URL: ${u}`); }
    const loopback = ["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname);
    if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && loopback) && !/^[a-z][a-z0-9+.-]*:$/i.test(parsed.protocol)) return oauthError(400, "invalid_redirect_uri", `redirect_uri must be https, a loopback http URL, or a custom scheme: ${u}`);
  }
  const method = typeof body.token_endpoint_auth_method === "string" ? body.token_endpoint_auth_method : "none";
  if (!["none", "client_secret_post", "client_secret_basic"].includes(method)) return oauthError(400, "invalid_client_metadata", "Unsupported token_endpoint_auth_method.");
  const grants = Array.isArray(body.grant_types) ? body.grant_types : ["authorization_code", "refresh_token"];
  if (grants.some((g) => !["authorization_code", "refresh_token"].includes(String(g)))) return oauthError(400, "invalid_client_metadata", "Only authorization_code and refresh_token grants are supported.");
  const { client, client_secret } = await registerClient({ client_name: typeof body.client_name === "string" && body.client_name.trim() ? body.client_name.trim() : "Unnamed agent", redirect_uris: uris, token_endpoint_auth_method: method, metadata: { client_uri: body.client_uri ?? null, logo_uri: body.logo_uri ?? null, software_id: body.software_id ?? null, software_version: body.software_version ?? null, registered_ip: ip } });
  await audit({ authorizationId: null, userId: null, clientId: client.client_id, accessMethod: "oauth", action: "client_registered", result: "success", detail: { client_name: client.client_name, redirect_uris: uris } });
  const origin = originOf(req);
  return NextResponse.json({
    client_id: client.client_id, client_id_issued_at: Math.floor(Date.now() / 1000), client_name: client.client_name, redirect_uris: uris,
    token_endpoint_auth_method: method, grant_types: grants, response_types: ["code"], scope: GRANTABLE_SCOPES.join(" "),
    ...(client_secret ? { client_secret, client_secret_expires_at: 0 } : {}),
    registration_client_uri: `${origin}/api/v1/agent/oauth/register/${client.client_id}`,
  }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
