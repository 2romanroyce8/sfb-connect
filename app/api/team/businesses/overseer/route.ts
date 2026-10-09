import { NextResponse, type NextRequest } from "next/server";
import { requireOwner } from "@/lib/team/requireOwner";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Owner-only: who oversees each customer business's agent.
export async function GET() {
  const ctx = await requireOwner();
  if ("error" in ctx) return ctx.error;
  const service = createSupabaseServiceClient();
  const [{ data: businesses, error }, { data: team }] = await Promise.all([
    service.from("businesses").select("id, legal_name, plan_key, agent_overseer_id, created_at").order("created_at", { ascending: false }),
    service.from("users").select("id, full_name, email, team_role").not("team_role", "is", null).eq("team_status", "active").order("created_at"),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ businesses: businesses ?? [], team: team ?? [] });
}

export async function PATCH(req: NextRequest) {
  const ctx = await requireOwner();
  if ("error" in ctx) return ctx.error;
  const body = (await req.json().catch(() => ({}))) as { businessId?: string; overseerId?: string | null };
  if (!body.businessId || !UUID.test(body.businessId)) return NextResponse.json({ error: "businessId required" }, { status: 400 });
  const overseerId = body.overseerId ? body.overseerId : null;
  if (overseerId && !UUID.test(overseerId)) return NextResponse.json({ error: "Invalid overseer" }, { status: 400 });
  const service = createSupabaseServiceClient();
  if (overseerId) {
    const { data: member } = await service.from("users").select("id").eq("id", overseerId).not("team_role", "is", null).eq("team_status", "active").maybeSingle();
    if (!member) return NextResponse.json({ error: "Overseer must be an active team member." }, { status: 400 });
  }
  const { data, error } = await service.from("businesses").update({ agent_overseer_id: overseerId, updated_at: new Date().toISOString() }).eq("id", body.businessId).select("id").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Business not found" }, { status: 404 });
  await service.from("billing_audit_log").insert({ business_id: body.businessId, action: "agent_overseer_assigned", detail: { overseer_id: overseerId, by: ctx.userId } });
  return NextResponse.json({ ok: true });
}
