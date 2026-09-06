import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSignedDownloadUrl } from "@/lib/crm/documentStorage";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // RLS on crm_documents already restricts a rep to published/team-visible
  // docs -- if this comes back empty, they don't get a link, period.
  const { data: doc } = await supabase.from("crm_documents").select("id, file_path").eq("id", params.id).single();
  if (!doc) return NextResponse.json({ error: "Document not found or not accessible." }, { status: 404 });
  if (!doc.file_path) return NextResponse.json({ error: "This document has no attached file." }, { status: 400 });

  try {
    const url = await getSignedDownloadUrl(doc.file_path);
    await supabase.from("crm_document_activity").insert({ document_id: doc.id, user_id: user.id, event_type: "downloaded" });
    return NextResponse.json({ url });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not generate download link." }, { status: 400 });
  }
}
