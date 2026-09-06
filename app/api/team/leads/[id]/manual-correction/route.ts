import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const TABLES: Record<string, string> = {
  contact: "crm_lead_contact_methods",
  location: "crm_lead_locations",
  social: "crm_lead_social_profiles",
};

// Manual edits never destroy the original research value -- `value` stays
// exactly what the pipeline found; `manual_value` is layered on top and the
// UI shows it with a "Manually Verified" badge instead of overwriting
// history.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { table, rowId, manualValue } = await req.json();
  const tableName = TABLES[table];
  if (!tableName || !rowId) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const { data: row } = await supabase.from(tableName).select("lead_id").eq("id", rowId).eq("lead_id", params.id).single();
  if (!row) return NextResponse.json({ error: "Record not found or not accessible." }, { status: 404 });

  const { error } = await supabase
    .from(tableName)
    .update({ manual_value: manualValue || null, edited_by: user.id, edited_at: new Date().toISOString() })
    .eq("id", rowId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await supabase.from("crm_activities").insert({ lead_id: params.id, rep_id: user.id, activity_type: "field_manually_corrected", description: `Manually corrected a ${table} field` });

  return NextResponse.json({ ok: true });
}
