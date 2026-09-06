import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { deleteDocumentFile } from "@/lib/crm/documentStorage";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: caller } = await supabase.from("users").select("team_role").eq("id", user.id).single();
  if (caller?.team_role !== "owner") return NextResponse.json({ error: "Only the owner can delete documents." }, { status: 403 });

  const { data: doc } = await supabase.from("crm_documents").select("file_path").eq("id", params.id).single();
  if (!doc) return NextResponse.json({ error: "Document not found." }, { status: 404 });

  if (doc.file_path) await deleteDocumentFile(doc.file_path);
  const { error } = await supabase.from("crm_documents").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
