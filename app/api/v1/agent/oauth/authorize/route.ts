import { NextResponse, type NextRequest } from "next/server";
import { getClient } from "@/lib/agent/store";
import { oauthError, redirectUriAllowed, CONSENT_PATH, originOf } from "@/lib/agent/oauth";
import { negotiateScopes } from "@/lib/agent/scopes";
export const dynamic = "force-dynamic";

// Authorization endpoint. Validates the request, then sends the user to the
// consent screen, which lives behind the normal /team login (middleware).
// Nothing is granted here; the grant happens in /approve after the signed-in
// user clicks Authorize.
export async function GET(req: NextRequest) {
  // new URL(req.url), not req.nextUrl: NextURL normalises loopback hosts inside
  // query values (127.0.0.1 -> localhost), which broke exact redirect_uri matching.
  const q = new URL(req.url).searchParams;
  const clientId = q.get("client_id") ?? "";
  const redirectUri = q.get("redirect_uri") ?? "";
  const client = clientId ? await getClient(clientId) : null;
  if (!client) return oauthError(400, "invalid_request", "Unknown client_id.");
  if (!redirectUri || !redirectUriAllowed(client, redirectUri)) return oauthError(400, "invalid_request", `redirect_uri is not registered for this client (received ${JSON.stringify(redirectUri)}; registered ${JSON.stringify(client.redirect_uris)}).`);
  const back = (error: string, description: string) => { const u = new URL(redirectUri); u.searchParams.set("error", error); u.searchParams.set("error_description", description); if (q.get("state")) u.searchParams.set("state", q.get("state")!); return NextResponse.redirect(u); };
  if (q.get("response_type") !== "code") return back("unsupported_response_type", "Only response_type=code is supported.");
  if (!q.get("code_challenge") || (q.get("code_challenge_method") ?? "S256") !== "S256") return back("invalid_request", "PKCE with code_challenge_method=S256 is required.");
  const { granted } = negotiateScopes(q.get("scope"));
  if (granted.length === 0) return back("invalid_scope", "None of the requested scopes can be granted (write scopes are not grantable).");
  const consent = new URL(CONSENT_PATH, originOf(req));
  for (const k of ["client_id", "redirect_uri", "state", "scope", "code_challenge", "code_challenge_method", "resource"]) { const v = q.get(k); if (v) consent.searchParams.set(k, v); }
  return NextResponse.redirect(consent);
}
