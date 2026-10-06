import { NextResponse, type NextRequest } from "next/server";
import { requireOwner } from "@/lib/team/requireOwner";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { RESET_CATEGORIES, RESET_CONFIRM_PHRASE } from "@/lib/team/dataRegistry";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// RESET WORKSPACE. Owner only; the exact phrase must be typed; a full JSON
// snapshot of every wiped table is written to crm_data_deletion_log BEFORE
// the first delete so nothing is lost without a recoverable copy. Users,
// roles, document folders, markets, scoring rules, calendar connections and
// connected agents are untouched -- the team keeps its structure and only
// the operational data is cleared.
export async function POST(req: NextRequest) {
  const ctx = await requireOwner();
  if ("error" in ctx) return ctx.error;
  const body = (await req.json().catch(() => ({}))) as { confirm?: string };
  if (body.confirm !== RESET_CONFIRM_PHRASE) return NextResponse.json({ error: `Type exactly: ${RESET_CONFIRM_PHRASE}` }, { status: 400 });
  const service = createSupabaseServiceClient();

  const snapshot: Record<string, unknown[]> = {};
  for (const c of RESET_CATEGORIES) {
    const { data } = await service.from(c.table).select("*").limit(10000);
    snapshot[c.table] = data ?? [];
  }
  const { data: logRow, error: logErr } = await service.from("crm_data_deletion_log").insert({ actor_id: ctx.userId, actor_email: ctx.email, kind: "reset", category: "workspace", rows_deleted: 0, snapshot }).select("id").single();
  if (logErr || !logRow) return NextResponse.json({ error: `Could not write the backup snapshot; nothing was deleted. ${logErr?.message ?? ""}` }, { status: 500 });

  const deleted: Record<string, number> = {};
  const failures: Record<string, string> = {};
  for (const c of RESET_CATEGORIES) {
    const { error, count } = await service.from(c.table).delete({ count: "exact" }).not("id", "is", null);
    if (error) failures[c.table] = error.message; else deleted[c.table] = count ?? 0;
  }
  const total = Object.values(deleted).reduce((a, b) => a + b, 0);
  await service.from("crm_data_deletion_log").update({ rows_deleted: total, detail: { deleted, failures } }).eq("id", logRow.id);
  return NextResponse.json({ ok: Object.keys(failures).length === 0, deleted, failures, total, backupId: logRow.id });
}
