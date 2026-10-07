import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthorization } from "@/lib/agent/store";
import { revokeAuthorizationFully } from "@/lib/agent/revoke";
export const dynamic = "force-dynamic";

// Revoke. The user who granted the authorization, or an owner, may revoke it
// (checked against the signed-in user, never against anything the caller supplies).
// Kills: OAuth tokens, the delegated API session, every browser session.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const authz = await getAuthorization(params.id);
  const { data: me } = await supabase.from("users").select("team_role").eq("id", user.id).single();
  // The granting user, or any owner (workspace oversight), may revoke.
  if (!authz || (authz.user_id !== user.id && me?.team_role !== "owner")) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const result = await revokeAuthorizationFully(authz.id, "user_revoked", user.id);
  return NextResponse.json({ ok: true, browser_sessions_closed: result?.browserSessionsClosed ?? 0 });
}
