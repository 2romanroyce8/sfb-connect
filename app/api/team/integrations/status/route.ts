import { NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { loadIntegrationRegistry } from "@/lib/integrations/registry";
import { listConnectionSummaries } from "@/lib/integrations/connections";
import { whatsappVerifyToken, whatsappConfigured } from "@/lib/integrations/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Registry + the caller's connections (owners also see everyone's, labels only — never tokens). */
export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { data: me } = await supabase.from("users").select("team_role").eq("id", user.id).single();
  const isOwner = me?.team_role === "owner";
  const [registry, mine, all] = await Promise.all([loadIntegrationRegistry(), listConnectionSummaries(user.id), isOwner ? listConnectionSummaries() : Promise.resolve([])]);
  let names: Record<string, string> = {};
  if (isOwner) {
    const { data: reps } = await createSupabaseServiceClient().from("users").select("id, full_name, email").not("team_role", "is", null);
    names = Object.fromEntries(((reps ?? []) as { id: string; full_name: string | null; email: string }[]).map((r) => [r.id, r.full_name || r.email]));
  }
  const [{ data: zk }, { data: wh }, { data: inb }] = isOwner
    ? await Promise.all([
        createSupabaseServiceClient().from("zapier_api_keys").select("id, label, created_at, last_used_at"),
        createSupabaseServiceClient().from("webhook_endpoints").select("id, url, events, active, failure_count, last_delivery_at, created_at, description"),
        createSupabaseServiceClient().from("inbound_webhook_tokens").select("id, label, received_count, last_received_at, created_at, file_task"),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];
  return NextResponse.json({ isOwner, registry, mine, whatsapp: isOwner ? { configured: whatsappConfigured(), verifyToken: whatsappVerifyToken(), webhookUrl: "https://www.sfbconnect.com/api/team/integrations/whatsapp/callback" } : null, team: all.map((c) => ({ ...c, owner_name: names[c.owner_id] ?? "—" })), zapierKeys: zk ?? [], webhookEndpoints: wh ?? [], inboundTokens: inb ?? [] });
}
