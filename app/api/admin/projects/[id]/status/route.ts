import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminGuard";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { PROJECT_STATUS_ORDER } from "@/lib/types";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status });

  const body = await req.json().catch(() => null);
  const status = body?.status as string | undefined;
  const note = body?.note as string | undefined;

  if (!status || !PROJECT_STATUS_ORDER.includes(status as any)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  const service = createSupabaseServiceClient();

  const update: Record<string, unknown> = { status };
  if (status === "completed") update.completed_at = new Date().toISOString();

  const { error } = await service.from("projects").update(update).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await service.from("project_status_history").insert({
    project_id: params.id,
    status,
    note: note || null,
    changed_by: guard.userId,
  });

  return NextResponse.json({ ok: true });
}
