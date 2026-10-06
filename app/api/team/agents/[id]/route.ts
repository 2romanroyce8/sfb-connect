import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { getAuthorization, revokeAuthorization, audit, svc } from "@/lib/agent/store";
import { signOutDelegatedSession } from "@/lib/agent/delegatedSession";
import { decryptToken } from "@/lib/crm/tokenCrypto";
export const dynamic = "force-dynamic";

// Revoke. Only the user who granted the authorization may revoke it (checked
// against the signed-in user, never against anything the caller supplies).
// Kills: OAuth tokens, the delegated API session, every browser session.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const authz = await getAuthorization(params.id);
  if (!authz || authz.user_id !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (authz.status === "active") {
    await signOutDelegatedSession(authz);
    const { data: handoffs } = await svc().from("agent_browser_handoffs").select("code_hash, browser_access_enc").eq("authorization_id", authz.id).not("browser_access_enc", "is", null);
    const admin = createSupabaseServiceClient();
    for (const h of handoffs ?? []) {
      try { await admin.auth.admin.signOut(decryptToken(h.browser_access_enc), "local"); } catch { /* session may already be gone */ }
    }
    await svc().from("agent_browser_handoffs").update({ browser_access_enc: null }).eq("authorization_id", authz.id);
    await revokeAuthorization(authz.id, "user_revoked");
    await audit({ authorizationId: authz.id, userId: user.id, clientId: authz.client_id, accessMethod: "oauth", action: "authorization_revoked", result: "success", detail: { browser_sessions_closed: handoffs?.length ?? 0 } });
  }
  return NextResponse.json({ ok: true });
}
