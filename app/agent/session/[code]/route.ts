import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { consumeBrowserHandoff, getAuthorization, audit, svc } from "@/lib/agent/store";
import { mintDelegatedSession } from "@/lib/agent/delegatedSession";
import { decryptToken } from "@/lib/crm/tokenCrypto";
import { AGENT_SESSION_COOKIE } from "@/lib/agent/readOnly";
import { REMEMBER_COOKIE } from "@/lib/supabase/sessionPolicy";
import { appOrigin } from "@/lib/agent/auth";
export const dynamic = "force-dynamic";

// Redeems a one-time browser handoff code. Mints a SEPARATE delegated
// Supabase session for the authorizing user (its own refresh chain), writes
// it as session-only auth cookies, and marks the browser as an agent session
// so the middleware can (a) re-check the authorization on every request and
// (b) refuse every mutating request. The agent never sees these cookies: it
// only ever had the URL, and the code is dead after this redirect.
export async function GET(req: NextRequest, { params }: { params: { code: string } }) {
  const origin = appOrigin(req);
  const fail = (reason: string) => NextResponse.redirect(new URL(`/team/login?error=${reason}`, origin));
  const authorizationId = await consumeBrowserHandoff(params.code);
  if (!authorizationId) return fail("agent_link_invalid");
  const authz = await getAuthorization(authorizationId);
  if (!authz || authz.status !== "active" || !authz.scopes.includes("sfb:browser")) return fail("agent_revoked");

  const nextRaw = req.nextUrl.searchParams.get("next") ?? "/team/dashboard";
  const next = /^\/team(\/|$)/.test(nextRaw) ? nextRaw : "/team/dashboard";
  const response = NextResponse.redirect(new URL(next, origin));
  const secure = origin.startsWith("https://");
  try {
    const minted = await mintDelegatedSession(authz.user_id);
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: { getAll: () => [], setAll: (list) => { for (const { name, value, options } of list) { const { maxAge: _m, expires: _e, ...rest } = options as Record<string, unknown>; response.cookies.set(name, value, { ...(rest as object), secure }); } } },
    });
    await supabase.auth.setSession({ access_token: decryptToken(minted.accessEnc), refresh_token: decryptToken(minted.refreshEnc) });
    response.cookies.set(REMEMBER_COOKIE, "0", { path: "/", secure, sameSite: "lax" });
    response.cookies.set(AGENT_SESSION_COOKIE, authz.id, { path: "/", httpOnly: true, secure, sameSite: "lax" });
    await svc().from("agent_browser_handoffs").update({ browser_access_enc: minted.accessEnc, browser_session_expires_at: minted.expiresAt }).eq("authorization_id", authz.id).not("used_at", "is", null).order("used_at", { ascending: false }).limit(1);
    await audit({ authorizationId: authz.id, userId: authz.user_id, clientId: authz.client_id, accessMethod: "browser", action: "browser_session_opened", resource: next, result: "success" });
    return response;
  } catch (e) {
    console.error("[agent-browser] handoff failed", e instanceof Error ? e.message : e);
    await audit({ authorizationId: authz.id, userId: authz.user_id, clientId: authz.client_id, accessMethod: "browser", action: "browser_session_opened", result: "error" });
    return fail("agent_session_failed");
  }
}
