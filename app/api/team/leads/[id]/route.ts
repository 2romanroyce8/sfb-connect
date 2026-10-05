import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const EDITABLE_FIELDS = ["business_name", "website", "phone", "email", "category", "description", "owner_name", "city", "state"];

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json();
  const update: Record<string, unknown> = {};
  for (const field of EDITABLE_FIELDS) {
    if (field in body) update[field] = body[field];
  }
  if (Object.keys(update).length === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  update.updated_at = new Date().toISOString();

  // RLS (owner: all, rep: assigned_rep = auth.uid()) governs this directly.
  const { error } = await supabase.from("crm_leads").update(update).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await supabase.from("crm_activities").insert({ lead_id: params.id, rep_id: user.id, activity_type: "lead_edited", description: "Lead details edited" });
  return NextResponse.json({ ok: true });
}

// Hard delete -- RLS's crm_leads_owner_all/crm_leads_owner_delete policies
// mean only the owner's session can actually delete a row; a rep's delete
// call affects zero rows rather than being blocked at the API layer alone.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: caller } = await supabase.from("users").select("team_role").eq("id", user.id).single();
  if (caller?.team_role !== "owner") return NextResponse.json({ error: "Only the owner can delete leads." }, { status: 403 });

  const { error, count } = await supabase.from("crm_leads").delete({ count: "exact" }).eq("id", params.id);
  if (error) {
    // 23503 = a row elsewhere still points at this lead. After the
    // 2026-10-05 migration the only remaining NO ACTION reference is
    // businesses.source_lead_id -- i.e. this lead was marked Won and became
    // a real customer account. That is deliberate: deleting it would erase
    // a paying customer's provenance. Say so plainly instead of leaking a
    // raw constraint name.
    if (error.code === "23503") {
      return NextResponse.json(
        { error: "This lead was converted into a customer account, so it can't be deleted. Archive it instead to hide it from the pipeline." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (!count) return NextResponse.json({ error: "Lead not found or already deleted." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
