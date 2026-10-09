import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CAPABILITY_KEYS, tier } from "@/lib/agentProgram/config";
export const dynamic = "force-dynamic";

// Customer toggles a capability for their own business. Free (0 credits).
// Trial accounts may keep at most `capabilityLimit` enabled; paid tiers all 8.
export async function PATCH(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { data: biz } = await supabase.from("businesses").select("id, plan_key").eq("owner_id", user.id).not("plan_key", "is", null).maybeSingle();
  if (!biz) return NextResponse.json({ error: "No business" }, { status: 404 });
  const b = (await req.json().catch(() => ({}))) as { capability?: string; enabled?: boolean };
  if (!b.capability || !(CAPABILITY_KEYS as string[]).includes(b.capability) || typeof b.enabled !== "boolean") return NextResponse.json({ error: "capability and enabled are required" }, { status: 400 });
  const t = tier(biz.plan_key);
  if (b.enabled && t && t.capabilityLimit < 8) {
    const { count } = await supabase.from("business_capabilities").select("capability_key", { count: "exact", head: true }).eq("business_id", biz.id).eq("enabled", true).neq("capability_key", b.capability);
    if ((count ?? 0) >= t.capabilityLimit) return NextResponse.json({ error: `The ${t.name} watches ${t.capabilityLimit} capabilities at a time. Switch one off first, or go live to run all eight.`, limit: t.capabilityLimit }, { status: 409 });
  }
  const { error } = await supabase.from("business_capabilities").upsert({ business_id: biz.id, capability_key: b.capability, enabled: b.enabled, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
