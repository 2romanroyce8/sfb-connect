import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MANUAL_STAGES } from "@/lib/crm/stages";
export const dynamic = "force-dynamic";

// Bulk lead actions for the Leads list multi-select. Session client on purpose: crm_leads RLS decides
// what each user can touch (owner: all; rep: only leads assigned to them) — same as the single-lead routes.
// "Won" is not offered in bulk: it needs the plan that was sold (revenue event) — do it per lead.
export async function POST(req: NextRequest) {
  const db = createSupabaseServerClient();
  const { data: { user } } = await db.auth.getUser(); if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { data: me } = await db.from("users").select("team_role").eq("id", user.id).single();
  if (!me?.team_role) return NextResponse.json({ error: "Team access required." }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { action?: string; ids?: string[]; stage?: string; rep_id?: string | null };
  const ids = (Array.isArray(b.ids) ? b.ids : []).filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 1000);
  if (!ids.length) return NextResponse.json({ ok: true, count: 0 });
  const now = new Date().toISOString();
  const { data: leads } = await db.from("crm_leads").select("id, pipeline_stage").in("id", ids); // RLS-filtered
  const visible = leads ?? [];
  switch (b.action) {
    case "stage": {
      if (!b.stage || !MANUAL_STAGES.includes(b.stage) || b.stage === "won") return NextResponse.json({ error: "Pick a stage (Won is set one lead at a time, with the plan sold)." }, { status: 400 });
      const moving = visible.filter((l) => l.pipeline_stage !== b.stage);
      if (moving.length) {
        const { error } = await db.from("crm_leads").update({ pipeline_stage: b.stage, updated_at: now }).in("id", moving.map((l) => l.id)); if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        await db.from("crm_pipeline_history").insert(moving.map((l) => ({ lead_id: l.id, from_stage: l.pipeline_stage, to_stage: b.stage, changed_by: user.id })));
        await db.from("crm_activities").insert(moving.map((l) => ({ lead_id: l.id, rep_id: user.id, activity_type: "pipeline_changed", description: `Moved from ${String(l.pipeline_stage).replace(/_/g, " ")} to ${b.stage!.replace(/_/g, " ")} (bulk)` })));
      }
      return NextResponse.json({ ok: true, count: moving.length, unchanged: visible.length - moving.length, notAllowed: ids.length - visible.length });
    }
    case "assign": {
      if (me.team_role !== "owner") return NextResponse.json({ error: "Only an owner can reassign leads." }, { status: 403 });
      const { error } = await db.from("crm_leads").update({ assigned_rep: b.rep_id || null, updated_at: now }).in("id", visible.map((l) => l.id)); if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      await db.from("crm_activities").insert(visible.map((l) => ({ lead_id: l.id, rep_id: user.id, activity_type: "lead_reassigned", description: "Lead reassigned (bulk)" })));
      return NextResponse.json({ ok: true, count: visible.length });
    }
    case "archive": {
      const { error } = await db.from("crm_leads").update({ archived: true, archived_at: now, updated_at: now }).in("id", visible.map((l) => l.id)); if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      await db.from("crm_activities").insert(visible.map((l) => ({ lead_id: l.id, rep_id: user.id, activity_type: "lead_archived", description: "Lead archived (bulk)" })));
      return NextResponse.json({ ok: true, count: visible.length });
    }
  }
  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
