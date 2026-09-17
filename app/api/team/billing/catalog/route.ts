import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const EDITABLE_FIELDS: Record<string, string[]> = {
  addon_products: ["name", "description", "best_for", "base_price_cents", "active", "featured", "sort_order", "category"],
  credit_packages: ["name", "credits", "price_cents", "active", "sort_order"],
  action_catalog: ["name", "description", "credit_cost", "active"],
};
const VALID_TABLES = Object.keys(EDITABLE_FIELDS);

// Owner-only catalog editor. RLS (*_team_owner_all policies) is the real
// gate here -- this route just narrows WHICH columns a request can touch,
// so a caller can never smuggle e.g. stripe_price_id or id through this
// generic endpoint.
export async function PATCH(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: caller } = await supabase.from("users").select("team_role").eq("id", user.id).single();
  if (caller?.team_role !== "owner") return NextResponse.json({ error: "Owner access required." }, { status: 403 });

  const body = await req.json();
  const { table, id, fields } = body as { table: string; id: string; fields: Record<string, unknown> };
  if (!VALID_TABLES.includes(table) || !id || !fields) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const allowed = EDITABLE_FIELDS[table];
  const update: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (allowed.includes(key)) update[key] = value;
  }
  if (Object.keys(update).length === 0) return NextResponse.json({ error: "No editable fields provided." }, { status: 400 });
  update.updated_at = new Date().toISOString();

  const { error } = await supabase.from(table).update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await supabase.from("billing_audit_log").insert({
    action: "catalog_updated",
    actor_id: user.id,
    detail: { table, id, fields: update },
  });

  return NextResponse.json({ ok: true });
}
