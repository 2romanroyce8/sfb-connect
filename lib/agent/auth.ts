import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { lookupAccessToken, touchAuthorization, rateLimit, audit, type AgentAuthorization } from "./store";
import { resolveDelegatedUserClient } from "./delegatedSession";
import type { Scope } from "./scopes";

export type AgentContext = {
  authorization: AgentAuthorization;
  user: SupabaseClient; // acts as the authorizing user -- RLS applies
  scopes: Set<string>;
  clientId: string;
  userId: string;
};

export class AgentAuthError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string, public readonly extraHeaders: Record<string, string> = {}) { super(message); }
}

/** The origin the client is actually talking to. Derived from the request
 * (so the OAuth issuer, token endpoint and handoff links stay on the exact
 * host the agent used -- the apex redirects to www, and a redirected POST
 * breaks token exchange); the configured app URL is only a fallback. */
export function appOrigin(req: NextRequest): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (host && /^(www\.)?sfbconnect\.com$|\.vercel\.app$|^localhost(:\d+)?$/.test(host)) {
    const proto = host.startsWith("localhost") ? "http" : "https";
    return `${proto}://${host}`;
  }
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ?? "https://www.sfbconnect.com";
}

export function bearerChallenge(origin: string, error?: string, description?: string): Record<string, string> {
  let v = `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"`;
  if (error) v += `, error="${error}"`;
  if (description) v += `, error_description="${description.replace(/"/g, "'")}"`;
  return { "WWW-Authenticate": v };
}

/** Resolves the Bearer token to an authorization + a Supabase client acting as the user. */
export async function authenticateAgent(req: NextRequest, accessMethod: "api" | "mcp"): Promise<AgentContext> {
  const origin = appOrigin(req);
  const header = req.headers.get("authorization") ?? "";
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) throw new AgentAuthError(401, "unauthenticated", "Missing bearer token.", bearerChallenge(origin));
  const looked = await lookupAccessToken(m[1].trim());
  if ("error" in looked) {
    await audit({ authorizationId: null, userId: null, clientId: null, accessMethod, action: "authenticate", result: "denied", detail: { reason: looked.error } });
    throw new AgentAuthError(401, `token_${looked.error}`, `Access token ${looked.error}.`, bearerChallenge(origin, "invalid_token", `token ${looked.error}`));
  }
  const auth = looked.authorization;
  const rl = await rateLimit(`auth:${auth.id}:1m`, 120, 60);
  if (!rl.allowed) {
    await audit({ authorizationId: auth.id, userId: auth.user_id, clientId: auth.client_id, accessMethod, action: "rate_limit", result: "denied" });
    throw new AgentAuthError(429, "rate_limited", "Too many requests for this authorization (120/min).", { "Retry-After": "30" });
  }
  const resolved = await resolveDelegatedUserClient(auth);
  if (!resolved) {
    if (!auth.delegated_refresh_enc) {
      // Nothing to refresh: the session was signed out (revoke) or never minted. Only here is re-authorization the answer.
      await audit({ authorizationId: auth.id, userId: auth.user_id, clientId: auth.client_id, accessMethod, action: "delegated_session", result: "error", detail: { reason: "no delegated session on this authorization" } });
      throw new AgentAuthError(401, "session_unavailable", "The delegated session for this authorization is no longer valid. Re-authorize.", bearerChallenge(origin, "invalid_token", "delegated session expired"));
    }
    // Refresh AND re-mint failed (Supabase auth unreachable, user deleted…). The agent's OAuth token is fine, so this must NOT carry an
    // invalid_token challenge: that is the standard "rotate your token" signal, and on 2026-10-10 it turned a Supabase hiccup into a
    // refresh storm and then a reuse revocation (the Muse server-side refresh bug). Tell the client to retry instead.
    await audit({ authorizationId: auth.id, userId: auth.user_id, clientId: auth.client_id, accessMethod, action: "delegated_session", result: "error", detail: { reason: "delegated session refresh and re-mint both failed" } });
    throw new AgentAuthError(503, "session_unavailable", "The delegated session could not be refreshed right now. Your access token is still valid — retry in a few seconds.", { "Retry-After": "5" });
  }
  if (resolved.via === "reminted") void audit({ authorizationId: auth.id, userId: auth.user_id, clientId: auth.client_id, accessMethod, action: "delegated_session", result: "success", detail: { via: "reminted" } });
  void touchAuthorization(auth.id);
  return { authorization: auth, user: resolved.client, scopes: new Set(auth.scopes), clientId: auth.client_id, userId: auth.user_id };
}

export function requireScope(ctx: AgentContext, scope: Scope) {
  if (!ctx.scopes.has(scope)) throw new AgentAuthError(403, "insufficient_scope", `This authorization does not include ${scope}.`, { "WWW-Authenticate": `Bearer error="insufficient_scope", scope="${scope}"` });
}
