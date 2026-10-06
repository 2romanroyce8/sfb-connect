import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { lookupAccessToken, touchAuthorization, rateLimit, audit, type AgentAuthorization } from "./store";
import { delegatedUserClient } from "./delegatedSession";
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

export function appOrigin(req: NextRequest): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
  if (explicit) return explicit;
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "www.sfbconnect.com";
  return `${proto}://${host}`;
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
  const user = await delegatedUserClient(auth);
  if (!user) {
    await audit({ authorizationId: auth.id, userId: auth.user_id, clientId: auth.client_id, accessMethod, action: "delegated_session", result: "error", detail: { reason: "delegated session unavailable" } });
    throw new AgentAuthError(401, "session_unavailable", "The delegated session for this authorization is no longer valid. Re-authorize.", bearerChallenge(origin, "invalid_token", "delegated session expired"));
  }
  void touchAuthorization(auth.id);
  return { authorization: auth, user, scopes: new Set(auth.scopes), clientId: auth.client_id, userId: auth.user_id };
}

export function requireScope(ctx: AgentContext, scope: Scope) {
  if (!ctx.scopes.has(scope)) throw new AgentAuthError(403, "insufficient_scope", `This authorization does not include ${scope}.`, { "WWW-Authenticate": `Bearer error="insufficient_scope", scope="${scope}"` });
}
