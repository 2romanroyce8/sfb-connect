import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { note } = await req.json();
  if (!note || !note.trim()) return NextResponse.json({ error: "Note can't be empty." }, { status: 400 });

  const { data: row, error } = await supabase
    .from("crm_notes")
    .insert({ lead_id: params.id, author_id: user.id, note_type: "manual", note: note.trim() })
    .select("id")
    .single();
  if (error || !row) return NextResponse.json({ error: error?.message || "Could not save note." }, { status: 400 });

  await supabase.from("crm_activities").insert({
    lead_id: params.id,
    rep_id: user.id,
    activity_type: "note_added",
    description: "Note added",
  });

  return NextResponse.json({ ok: true, id: row.id });
}
