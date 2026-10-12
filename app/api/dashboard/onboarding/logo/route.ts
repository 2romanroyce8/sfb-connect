import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { customerBusiness } from "@/lib/onboarding/state";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/svg+xml": "svg", "image/webp": "webp" };

/** Step 4 fallback: upload a logo (≤ 2 MB, png/jpg/svg/webp) into the public brand-assets bucket under the business's own folder. */
export async function POST(req: NextRequest) {
  const who = await customerBusiness(createSupabaseServerClient());
  if (!who) return NextResponse.json({ error: "No active membership." }, { status: 403 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose an image file." }, { status: 400 });
  const ext = TYPES[file.type]; if (!ext) return NextResponse.json({ error: "PNG, JPG, SVG or WebP only." }, { status: 400 });
  if (file.size > 2 * 1024 * 1024) return NextResponse.json({ error: "Keep the logo under 2 MB." }, { status: 400 });
  const service = createSupabaseServiceClient();
  const path = `${who.businessId}/logo-${Date.now()}.${ext}`;
  const { error } = await service.storage.from("brand-assets").upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { data: pub } = service.storage.from("brand-assets").getPublicUrl(path);
  await service.from("businesses").update({ brand_logo_url: pub.publicUrl, updated_at: new Date().toISOString() }).eq("id", who.businessId);
  return NextResponse.json({ ok: true, logoUrl: pub.publicUrl });
}
