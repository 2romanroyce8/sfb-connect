import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminGuard";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

/**
 * Publishes the final Presence Report for a project. In production, upload
 * the report file to Supabase Storage first and pass its public URL here.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status });

  const body = await req.json().catch(() => null);
  const { fileUrl, summary } = body || {};
  if (!fileUrl) return NextResponse.json({ error: "fileUrl is required." }, { status: 400 });

  const service = createSupabaseServiceClient();
  const { error } = await service.from("reports").insert({
    project_id: params.id,
    file_url: fileUrl,
    summary: summary || null,
    published_at: new Date().toISOString(),
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await service
    .from("projects")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", params.id);

  return NextResponse.json({ ok: true });
}
