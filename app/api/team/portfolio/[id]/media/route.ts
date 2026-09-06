import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";

// Media upload for a portfolio project (cover / desktop / mobile / detail
// screenshots). Authorization is checked against the real session first;
// the actual storage write uses the service client only because anon/authed
// clients can't upload to a bucket without a storage policy, and this
// endpoint IS the access-control layer (owner-only, enforced below) rather
// than relying on a storage RLS policy.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { data: caller } = await supabase.from("users").select("team_role").eq("id", user.id).single();
  if (caller?.team_role !== "owner") return NextResponse.json({ error: "Owner access required." }, { status: 403 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const type = (form.get("type") as string) || "desktop";
  const altText = (form.get("altText") as string) || null;
  if (!file) return NextResponse.json({ error: "No file provided." }, { status: 400 });
  if (!["cover", "desktop", "mobile", "detail"].includes(type)) {
    return NextResponse.json({ error: "Invalid media type." }, { status: 400 });
  }

  const service = createSupabaseServiceClient();
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${params.id}/${type}-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await service.storage.from("portfolio-media").upload(path, buffer, { contentType: file.type, upsert: false });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 });

  const { data: publicUrlData } = service.storage.from("portfolio-media").getPublicUrl(path);
  const publicUrl = publicUrlData.publicUrl;

  const { data: maxRow } = await supabase.from("portfolio_media").select("sort_order").eq("project_id", params.id).order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const nextSort = (maxRow?.sort_order ?? -1) + 1;

  const { data: mediaRow, error: insertError } = await supabase
    .from("portfolio_media")
    .insert({ project_id: params.id, type, url: publicUrl, alt_text: altText, sort_order: nextSort })
    .select("*")
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 });

  // If this is a cover upload, also set it as the project's cover_image_url
  // so homepage/portfolio-list previews have something to show.
  if (type === "cover") {
    await supabase.from("portfolio_projects").update({ cover_image_url: publicUrl }).eq("id", params.id);
  }

  return NextResponse.json({ media: mediaRow, url: publicUrl });
}
