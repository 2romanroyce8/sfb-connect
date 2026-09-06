import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const EDITABLE = ["title", "description", "startDate", "endDate", "status", "visualVariant", "assignedTo", "rowIndex"];
const FIELD_MAP: Record<string, string> = { startDate: "start_date", endDate: "end_date", visualVariant: "visual_variant", assignedTo: "assigned_to", rowIndex: "row_index" };

// RLS lets the owner edit anything; an assignee can only update their own
// item's status (the assignee UPDATE policy has no column restriction at the
// DB level today, so the API layer enforces "status only" for non-owners as
// a defense-in-depth measure, not the only line of defense).
export async function PATCH(req: NextRequest, { params }: { params: { id: string; itemId: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: caller } = await supabase.from("users").select("team_role").eq("id", user.id).single();
  const isOwner = caller?.team_role === "owner";

  const body = await req.json();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const allowedKeys = isOwner ? EDITABLE : ["status"];
  for (const key of allowedKeys) {
    if (key in body) update[FIELD_MAP[key] || key] = body[key];
  }
  if (Object.keys(update).length === 1) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  const { error } = await supabase.from("crm_work_plan_items").update(update).eq("id", params.itemId).eq("work_plan_id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string; itemId: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { error } = await supabase.from("crm_work_plan_items").delete().eq("id", params.itemId).eq("work_plan_id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
