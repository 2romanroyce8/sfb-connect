import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
// Settings -> Connected Agents. RLS: a user sees only their own authorizations and audit rows.
export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const [{ data: auths, error }, { data: clients }, { data: log }] = await Promise.all([
    supabase.from("agent_authorizations").select("id, client_id, workspace_label, scopes, status, created_at, last_used_at, revoked_at, revoked_reason").order("created_at", { ascending: false }).limit(50),
    supabase.from("agent_clients").select("client_id, client_name"),
    supabase.from("agent_audit_log").select("id, authorization_id, client_id, access_method, action, resource, result, created_at").order("created_at", { ascending: false }).limit(60),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const names = new Map((clients ?? []).map((c) => [c.client_id, c.client_name]));
  return NextResponse.json({ authorizations: (auths ?? []).map((a) => ({ ...a, client_name: names.get(a.client_id) ?? a.client_id })), audit: log ?? [] });
}
