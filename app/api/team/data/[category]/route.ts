import { NextResponse, type NextRequest } from "next/server";
import { requireOwner } from "@/lib/team/requireOwner";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { CATEGORY_BY_KEY } from "@/lib/team/dataRegistry";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// DELETE /api/team/data/<category>?id=<uuid>   -> one row (snapshotted to the log first)
// DELETE /api/team/data/<category>?all=1       -> every row in the category
export async function DELETE(req: NextRequest, { params }: { params: { category: string } }) {
  const ctx = await requireOwner();
  if ("error" in ctx) return ctx.error;
  const cat = CATEGORY_BY_KEY.get(params.category);
  if (!cat) return NextResponse.json({ error: "Unknown category" }, { status: 404 });
  const service = createSupabaseServiceClient();
  const id = req.nextUrl.searchParams.get("id");
  const all = req.nextUrl.searchParams.get("all") === "1";

  if (id) {
    if (!UUID_RE.test(id) && !/^\d+$/.test(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    const { data: before } = await service.from(cat.table).select("*").eq("id", id).maybeSingle();
    if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const { error } = await service.from(cat.table).delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await service.from("crm_data_deletion_log").insert({ actor_id: ctx.userId, actor_email: ctx.email, kind: "row", category: cat.key, row_id: String(id), rows_deleted: 1, snapshot: { [cat.table]: [before] } });
    return NextResponse.json({ ok: true, deleted: 1 });
  }
  if (all) {
    const { data: rows } = await service.from(cat.table).select("*").limit(5000);
    const { error, count } = await service.from(cat.table).delete({ count: "exact" }).not("id", "is", null);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await service.from("crm_data_deletion_log").insert({ actor_id: ctx.userId, actor_email: ctx.email, kind: "category", category: cat.key, rows_deleted: count ?? rows?.length ?? 0, snapshot: { [cat.table]: rows ?? [] } });
    return NextResponse.json({ ok: true, deleted: count ?? 0 });
  }
  return NextResponse.json({ error: "Pass ?id=<id> or ?all=1" }, { status: 400 });
}
