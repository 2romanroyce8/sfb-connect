import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { PROMPT_FILES_BUCKET } from "@/lib/crm/promptQueue";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Download a card attachment: team members only; redirects to a 5-minute signed URL. */
export async function GET(_req: NextRequest, { params }: { params: { fileId: string } }) {
  const supabase = createSupabaseServerClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { data: me } = await supabase.from("users").select("team_role").eq("id", user.id).single();
  if (!me?.team_role) return NextResponse.json({ error: "Team access required." }, { status: 403 });
  if (!/^[0-9a-f-]{36}$/i.test(params.fileId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const service = createSupabaseServiceClient();
  const { data: f } = await service.from("prompt_card_files").select("storage_path, filename").eq("id", params.fileId).maybeSingle();
  if (!f) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { data, error } = await service.storage.from(PROMPT_FILES_BUCKET).createSignedUrl(f.storage_path as string, 300, { download: f.filename as string });
  if (error || !data) return NextResponse.json({ error: "Could not create a download link." }, { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}
