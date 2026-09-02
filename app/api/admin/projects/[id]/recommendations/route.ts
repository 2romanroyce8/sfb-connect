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
  const { title, description, priority } = body || {};
  if (!title) return NextResponse.json({ error: "title is required." }, { status: 400 });

  const service = createSupabaseServiceClient();
  const { error } = await service.from("recommendations").insert({
    project_id: params.id,
    title,
    description: description || null,
    priority: priority || "medium",
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status });

  const body = await req.json().catch(() => null);
  const { recommendationId, status } = body || {};
  if (!recommendationId || !status) {
    return NextResponse.json({ error: "recommendationId and status required." }, { status: 400 });
  }

  const service = createSupabaseServiceClient();
  const { error } = await service
    .from("recommendations")
    .update({ status })
    .eq("id", recommendationId)
    .eq("project_id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
