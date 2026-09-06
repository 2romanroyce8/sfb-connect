import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: existing } = await supabase.from("crm_document_bookmarks").select("document_id").eq("document_id", params.id).eq("user_id", user.id).maybeSingle();

  if (existing) {
    await supabase.from("crm_document_bookmarks").delete().eq("document_id", params.id).eq("user_id", user.id);
    return NextResponse.json({ bookmarked: false });
  }

  const { error } = await supabase.from("crm_document_bookmarks").insert({ document_id: params.id, user_id: user.id });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await supabase.from("crm_document_activity").insert({ document_id: params.id, user_id: user.id, event_type: "bookmarked" });
  return NextResponse.json({ bookmarked: true });
}
