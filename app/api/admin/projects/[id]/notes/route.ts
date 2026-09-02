import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminGuard";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status });

  const body = await req.json().catch(() => null);
  const note = body?.note as string | undefined;
  if (!note) return NextResponse.json({ error: "note is required." }, { status: 400 });

  const service = createSupabaseServiceClient();
  const { error } = await service.from("admin_notes").insert({
    project_id: params.id,
    author_id: guard.userId,
    note,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
