import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { decryptToken } from "@/lib/crm/tokenCrypto";
import { getAuthorization, revokeAuthorization, svc, audit } from "./store";
import { signOutDelegatedSession } from "./delegatedSession";

/** The ONE revocation path, used by the Settings "Revoke" button, refresh-token
 * reuse detection and client-initiated revocation alike. Kills, in order: the
 * delegated API session (Supabase, local sign-out), every delegated browser
 * session minted through a handoff, then the OAuth tokens, codes and handoffs.
 * The user's own sessions are never touched. */
export async function revokeAuthorizationFully(id: string, reason: string, actorUserId: string | null = null): Promise<{ browserSessionsClosed: number } | null> {
  const authz = await getAuthorization(id);
  if (!authz) return null;
  let browserSessionsClosed = 0;
  if (authz.status === "active" || authz.delegated_refresh_enc) {
    await signOutDelegatedSession(authz);
    const { data: handoffs } = await svc().from("agent_browser_handoffs").select("code_hash, browser_access_enc").eq("authorization_id", authz.id).not("browser_access_enc", "is", null);
    const admin = createSupabaseServiceClient();
    for (const h of handoffs ?? []) {
      try { await admin.auth.admin.signOut(decryptToken(h.browser_access_enc), "local"); browserSessionsClosed++; } catch { /* already gone */ }
    }
    await svc().from("agent_browser_handoffs").update({ browser_access_enc: null }).eq("authorization_id", authz.id);
  }
  if (authz.status === "active") {
    await revokeAuthorization(authz.id, reason);
    await audit({ authorizationId: authz.id, userId: actorUserId ?? authz.user_id, clientId: authz.client_id, accessMethod: "oauth", action: "authorization_revoked", result: "success", detail: { reason, browser_sessions_closed: browserSessionsClosed } });
  }
  return { browserSessionsClosed };
}
