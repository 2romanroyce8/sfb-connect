import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getClient, createAuthorization, issueAuthCode, audit } from "@/lib/agent/store";
import { mintDelegatedSession } from "@/lib/agent/delegatedSession";
import { redirectUriAllowed, canonicalRedirectUri, originOf } from "@/lib/agent/oauth";
import { negotiateScopes } from "@/lib/agent/scopes";
import { AGENT_SESSION_COOKIE } from "@/lib/agent/readOnly";
export const dynamic = "force-dynamic";

// The consent decision. Runs as the SIGNED-IN user (their own cookies) -- an
// agent cannot call this. Re-validates everything the authorize endpoint
// validated (the consent form's hidden fields are untrusted input).
export async function POST(req: NextRequest) {
  const origin = originOf(req);
  const src = req.headers.get("origin") ?? (req.headers.get("referer") ? new URL(req.headers.get("referer")!).origin : "");
  if (src !== origin) return NextResponse.json({ error: "cross_origin" }, { status: 403 });
  if (req.cookies.get(AGENT_SESSION_COOKIE)) return NextResponse.json({ error: "agent_session_cannot_authorize", message: "A delegated agent session cannot authorize further agents." }, { status: 403 });

  const form = await req.formData();
  const g = (k: string) => { const v = form.get(k); return typeof v === "string" ? v : ""; };
  const client = await getClient(g("client_id"));
  const redirectUri = g("redirect_uri");
  if (!client || !redirectUri || !redirectUriAllowed(client, redirectUri)) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const back = (params: Record<string, string>) => { const u = new URL(redirectUri); for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v); return NextResponse.redirect(u, 303); };

  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL(`/team/login?next=${encodeURIComponent(req.nextUrl.pathname)}`, origin), 303);
  const { data: profile } = await supabase.from("users").select("team_role, team_status").eq("id", user.id).single();
  if (!profile?.team_role || profile.team_status === "disabled") return NextResponse.json({ error: "not_a_team_member" }, { status: 403 });

  if (g("decision") !== "approve") {
    await audit({ authorizationId: null, userId: user.id, clientId: client.client_id, accessMethod: "oauth", action: "consent_denied", result: "denied" });
    return back({ error: "access_denied", error_description: "The user declined.", state: g("state") });
  }
  const { granted } = negotiateScopes(g("scope"));
  if (granted.length === 0) return back({ error: "invalid_scope", state: g("state") });
  if (!g("code_challenge")) return back({ error: "invalid_request", error_description: "PKCE required.", state: g("state") });

  try {
    const delegated = await mintDelegatedSession(user.id);
    const authz = await createAuthorization({ userId: user.id, clientId: client.client_id, scopes: granted, workspaceLabel: "SFB Connect Team", delegatedRefreshEnc: delegated.refreshEnc, delegatedAccessEnc: delegated.accessEnc, delegatedAccessExpiresAt: delegated.expiresAt });
    const code = await issueAuthCode({ authorizationId: authz.id, redirectUri: canonicalRedirectUri(redirectUri), codeChallenge: g("code_challenge"), codeChallengeMethod: "S256", resource: g("resource") || null });
    await audit({ authorizationId: authz.id, userId: user.id, clientId: client.client_id, accessMethod: "oauth", action: "consent_granted", result: "success", detail: { scopes: granted } });
    return back({ code, state: g("state") });
  } catch (e) {
    console.error("[agent-oauth] approve failed", e instanceof Error ? e.message : e);
    return back({ error: "server_error", error_description: "Could not create the authorization.", state: g("state") });
  }
}
