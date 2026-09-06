import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { archived } = await req.json();
  const { error } = await supabase
    .from("crm_leads")
    .update({ archived: !!archived, archived_at: archived ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await supabase.from("crm_activities").insert({ lead_id: params.id, rep_id: user.id, activity_type: archived ? "lead_archived" : "lead_unarchived", description: archived ? "Lead archived" : "Lead unarchived" });
  return NextResponse.json({ ok: true });
}
