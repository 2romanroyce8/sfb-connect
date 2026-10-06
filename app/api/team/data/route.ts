import { NextResponse, type NextRequest } from "next/server";
import { requireOwner } from "@/lib/team/requireOwner";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { DATA_CATEGORIES, CATEGORY_BY_KEY, RESET_CONFIRM_PHRASE, rowLabel } from "@/lib/team/dataRegistry";
export const dynamic = "force-dynamic";

// Owner data control: counts for every category, or the most recent rows of
// one category (?category=key). Service role is used only AFTER the owner
// check, because the owner must be able to see and delete every row,
// including reps' own notes/calls that RLS would otherwise hide.
export async function GET(req: NextRequest) {
  const ctx = await requireOwner();
  if ("error" in ctx) return ctx.error;
  const service = createSupabaseServiceClient();
  const key = req.nextUrl.searchParams.get("category");
  if (key) {
    const cat = CATEGORY_BY_KEY.get(key);
    if (!cat) return NextResponse.json({ error: "Unknown category" }, { status: 404 });
    const q = service.from(cat.table).select("*").limit(50);
    const { data, error } = await (cat.orderBy ? q.order(cat.orderBy, { ascending: false }) : q.order("created_at", { ascending: false }));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ category: cat, rows: (data ?? []).map((r) => ({ id: r.id, label: rowLabel(r), created_at: r.created_at ?? r[cat.orderBy ?? ""] ?? null, row: r })) });
  }
  const counts = await Promise.all(DATA_CATEGORIES.map(async (c) => {
    const { count, error } = await service.from(c.table).select("id", { count: "exact", head: true });
    return { ...c, count: error ? null : count ?? 0, error: error?.message ?? null };
  }));
  const { data: log } = await service.from("crm_data_deletion_log").select("id, kind, category, row_id, rows_deleted, created_at, actor_email").order("id", { ascending: false }).limit(30);
  return NextResponse.json({ categories: counts, resetPhrase: RESET_CONFIRM_PHRASE, log: log ?? [] });
}
