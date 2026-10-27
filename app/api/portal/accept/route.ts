import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { hashInviteToken, inviteProblem } from "@/lib/agency/invite";
import { rateLimit } from "@/lib/agent/store";
export const dynamic = "force-dynamic";

// A signed-in person accepts a client invite. The invite must match THEIR email, be unexpired and unused. The membership is written with the service client
// (clients can never add themselves). The single-use claim is atomic (update ... where accepted_at is null).
export async function POST(req: NextRequest) {
  const { data: { user } } = await createSupabaseServerClient().auth.getUser(); if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!(await rateLimit(`invite-accept:${user.id}:1h`, 20, 3600)).allowed) return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  const b = (await req.json().catch(() => ({}))) as { token?: unknown }; if (typeof b.token !== "string" || b.token.length < 20 || b.token.length > 200) return NextResponse.json({ error: "This invite link isn't valid." }, { status: 400 });
  const svc = createSupabaseServiceClient(); const hash = hashInviteToken(b.token);
  const { data: inv } = await svc.from("agy_client_invites").select("id, client_id, agency_id, email, expires_at, accepted_at").eq("token_hash", hash).maybeSingle();
  const why = inviteProblem(inv ? { expires_at: inv.expires_at as string, accepted_at: inv.accepted_at as string | null, email: inv.email as string } : null, user.email); if (why) return NextResponse.json({ error: why }, { status: 403 });
  const { data: claimed } = await svc.from("agy_client_invites").update({ accepted_at: new Date().toISOString(), accepted_by: user.id }).eq("id", inv!.id).is("accepted_at", null).select("id");
  if (!claimed?.length) return NextResponse.json({ error: "This invite was already used." }, { status: 409 });
  const { error } = await svc.from("agy_client_members").upsert({ client_id: inv!.client_id, agency_id: inv!.agency_id, user_id: user.id }, { onConflict: "client_id,user_id" });
  if (error) { await svc.from("agy_client_invites").update({ accepted_at: null, accepted_by: null }).eq("id", inv!.id); return NextResponse.json({ error: "Couldn't finish joining. Try the link again." }, { status: 500 }); }
  return NextResponse.json({ ok: true });
}
