import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; mediaId: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { data: caller } = await supabase.from("users").select("team_role").eq("id", user.id).single();
  if (caller?.team_role !== "owner") return NextResponse.json({ error: "Owner access required." }, { status: 403 });

  const { data: mediaRow } = await supabase.from("portfolio_media").select("url").eq("id", params.mediaId).single();
  const { error } = await supabase.from("portfolio_media").delete().eq("id", params.mediaId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (mediaRow?.url) {
    const service = createSupabaseServiceClient();
    const marker = "/portfolio-media/";
    const idx = mediaRow.url.indexOf(marker);
    if (idx !== -1) {
      const objectPath = mediaRow.url.slice(idx + marker.length);
      await service.storage.from("portfolio-media").remove([objectPath]);
    }
  }

  return NextResponse.json({ ok: true });
}
