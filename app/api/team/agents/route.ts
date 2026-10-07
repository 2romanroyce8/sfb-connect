import { NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
// Settings -> Connected Agents. RLS: a user sees only their own authorizations and audit rows.
export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  // Owners see every team member's agent authorizations (workspace-wide
  // oversight); everyone else sees only their own, via RLS.
  const { data: me } = await supabase.from("users").select("team_role").eq("id", user.id).single();
  const isOwner = me?.team_role === "owner";
  const db = isOwner ? createSupabaseServiceClient() : supabase;
  const [{ data: auths, error }, { data: clients }, { data: log }, { data: people }] = await Promise.all([
    db.from("agent_authorizations").select("id, user_id, client_id, workspace_label, scopes, status, created_at, last_used_at, revoked_at, revoked_reason").order("created_at", { ascending: false }).limit(50),
    db.from("agent_clients").select("client_id, client_name"),
    db.from("agent_audit_log").select("id, authorization_id, user_id, client_id, access_method, action, resource, result, created_at").order("created_at", { ascending: false }).limit(60),
    isOwner ? db.from("users").select("id, full_name, email").not("team_role", "is", null) : Promise.resolve({ data: [] as { id: string; full_name: string | null; email: string }[] }),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const names = new Map((clients ?? []).map((c) => [c.client_id, c.client_name]));
  const who = new Map((people ?? []).map((p) => [p.id, p.full_name || p.email]));
  return NextResponse.json({
    isOwner,
    authorizations: (auths ?? []).map((a) => ({ ...a, client_name: names.get(a.client_id) ?? a.client_id, authorized_by: a.user_id === user.id ? "you" : who.get(a.user_id) ?? null })),
    audit: (log ?? []).map((l) => ({ ...l, actor: l.user_id === user.id ? "you" : who.get(l.user_id) ?? null })),
  });
}
