import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { teamCaller, SETUP_MSG, missingTable } from "@/lib/boardroom/auth";
import { campaignDraftFromIdea, planProblems, CHANNELS, type Idea, type Plan } from "@/lib/boardroom/loop";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const me = await teamCaller(); if (!me) return NextResponse.json({ error: "Team access required." }, { status: 403 });
  const db = createSupabaseServiceClient();
  const [{ data: ideas, error }, { data: sessions }, { data: votes }, { data: users }] = await Promise.all([
    db.from("board_ideas").select("*").order("updated_at", { ascending: false }).limit(500),
    db.from("board_sessions").select("*").order("created_at", { ascending: false }).limit(50),
    db.from("board_votes").select("idea_id, user_id"),
    db.from("users").select("id, full_name, email").not("team_role", "is", null),
  ]);
  if (missingTable(error)) return NextResponse.json({ setupNeeded: true, message: SETUP_MSG });
  const name = new Map((users ?? []).map((u) => [u.id as string, (u.full_name || u.email) as string]));
  const count = new Map<string, number>(); const mine = new Set<string>();
  for (const v of votes ?? []) { count.set(v.idea_id as string, (count.get(v.idea_id as string) ?? 0) + 1); if (v.user_id === me.id) mine.add(v.idea_id as string); }
  return NextResponse.json({ me: { id: me.id, role: me.team_role }, sessions: sessions ?? [], ideas: (ideas ?? []).map((i) => ({ ...i, votes: count.get(i.id as string) ?? 0, voted: mine.has(i.id as string), author: name.get(i.created_by as string) ?? "—" })) });
}

const STATUSES = ["draft", "ready", "tested", "killed"];
export async function POST(req: NextRequest) {
  const me = await teamCaller(); if (!me) return NextResponse.json({ error: "Team access required." }, { status: 403 });
  const db = createSupabaseServiceClient();
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const s = (k: string, max = 2000) => (typeof b[k] === "string" ? (b[k] as string).trim().slice(0, max) : "");
  const now = new Date().toISOString();
  const idea = async (id: string) => (await db.from("board_ideas").select("*").eq("id", id).maybeSingle()).data as (Idea & { kill_reason: string | null; session_id: string | null; last_campaign_id: string | null }) | null;
  try {
    switch (b.action) {
      case "create_idea": {
        if (s("title", 200).length < 3) return NextResponse.json({ error: "Give the idea a title." }, { status: 400 });
        const { data, error } = await db.from("board_ideas").insert({ title: s("title", 200), description: s("description") || null, target_metric: s("target_metric", 200) || null, session_id: s("session_id") || null, created_by: me.id }).select("id").single();
        if (error) return NextResponse.json({ error: missingTable(error) ? SETUP_MSG : error.message }, { status: 400 });
        return NextResponse.json({ ok: true, id: data.id });
      }
      case "update_idea": {
        const patch: Record<string, unknown> = { updated_at: now };
        for (const k of ["title", "description", "target_metric"]) if (typeof b[k] === "string") patch[k] = s(k, k === "title" ? 200 : 2000) || null;
        if (typeof b.status === "string" && STATUSES.includes(b.status) && b.status !== "killed") patch.status = b.status;
        await db.from("board_ideas").update(patch).eq("id", s("id")); return NextResponse.json({ ok: true });
      }
      case "kill_idea": {
        if (s("reason").length < 3) return NextResponse.json({ error: "Say why it's killed — that's what stops the team repeating it." }, { status: 400 });
        await db.from("board_ideas").update({ status: "killed", kill_reason: s("reason"), killed_at: now, decision: b.from_results ? "kill" : null, updated_at: now }).eq("id", s("id")); return NextResponse.json({ ok: true });
      }
      case "revive_idea": await db.from("board_ideas").update({ status: "draft", updated_at: now }).eq("id", s("id")).eq("status", "killed"); return NextResponse.json({ ok: true });
      case "bulk_delete": { const ids = (Array.isArray(b.ids) ? (b.ids as string[]) : []).slice(0, 500); const { data } = await db.from("board_ideas").delete().in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]).select("id"); return NextResponse.json({ ok: true, count: (data ?? []).length }); }
      case "bulk_status": {
        const st = s("status"); if (!["draft", "ready", "tested"].includes(st)) return NextResponse.json({ error: "Pick draft, ready or tested (killing needs a reason, one at a time)." }, { status: 400 });
        const ids = (Array.isArray(b.ids) ? (b.ids as string[]) : []).slice(0, 500);
        const { data } = await db.from("board_ideas").update({ status: st, updated_at: now }).in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]).neq("status", "killed").select("id");
        return NextResponse.json({ ok: true, count: (data ?? []).length });
      }
      case "vote": await db.from("board_votes").upsert({ idea_id: s("id"), user_id: me.id }); return NextResponse.json({ ok: true });
      case "unvote": await db.from("board_votes").delete().eq("idea_id", s("id")).eq("user_id", me.id); return NextResponse.json({ ok: true });
      case "start_session": {
        if (s("topic", 200).length < 3) return NextResponse.json({ error: "Name the topic." }, { status: 400 });
        const { data, error } = await db.from("board_sessions").insert({ topic: s("topic", 200), created_by: me.id }).select("id").single();
        if (error) return NextResponse.json({ error: missingTable(error) ? SETUP_MSG : error.message }, { status: 400 });
        return NextResponse.json({ ok: true, id: data.id });
      }
      case "close_session": await db.from("board_sessions").update({ status: "closed", closed_at: now }).eq("id", s("id")); return NextResponse.json({ ok: true });
      case "save_plan": {
        const p = (b.plan ?? {}) as Partial<Plan>;
        const plan: Plan = { what: String(p.what ?? "").trim().slice(0, 2000), who: String(p.who ?? "").trim().slice(0, 1000), success: String(p.success ?? "").trim().slice(0, 1000), duration_days: Math.round(Number(p.duration_days) || 0), channels: (Array.isArray(p.channels) ? p.channels : []).map(String).filter((c) => (CHANNELS as readonly string[]).includes(c)), audience_tag: String(p.audience_tag ?? "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 60) || null };
        const problems = planProblems(plan);
        await db.from("board_ideas").update({ plan, status: problems.length ? undefined : "ready", updated_at: now }).eq("id", s("id"));
        return NextResponse.json({ ok: true, problems });
      }
      case "send_to_campaigns": {
        const i = await idea(s("id")); if (!i) return NextResponse.json({ error: "Idea not found." }, { status: 404 });
        if (i.status === "killed") return NextResponse.json({ error: "This idea is killed. Revive it first." }, { status: 400 });
        const problems = planProblems(i.plan); if (problems.length) return NextResponse.json({ error: `Finish the plan first: ${problems.join(", ")}.` }, { status: 400 });
        const draft = campaignDraftFromIdea(i);
        const { data: c, error } = await db.from("campaigns").insert({ ...draft, created_by: me.id }).select("id").single();
        if (error || !c) return NextResponse.json({ error: error?.message ?? "Could not create the campaign." }, { status: 400 });
        await db.from("campaign_variants").insert([{ campaign_id: c.id, name: "Variant A" }, { campaign_id: c.id, name: "Variant B" }]);
        await db.from("board_ideas").update({ status: "ready", last_campaign_id: c.id, updated_at: now }).eq("id", i.id);
        return NextResponse.json({ ok: true, campaignId: c.id });
      }
      case "decide": {
        const d = s("decision"); const i = await idea(s("id")); if (!i) return NextResponse.json({ error: "Idea not found." }, { status: 404 });
        if (d === "kill") return NextResponse.json({ error: "Use Kill with a reason." }, { status: 400 });
        if (d === "scale") { await db.from("board_ideas").update({ decision: "scale", updated_at: now }).eq("id", i.id); return NextResponse.json({ ok: true }); }
        if (d === "iterate") {
          const { data } = await db.from("board_ideas").insert({ title: `${i.title} (v2)`.slice(0, 200), description: i.description, target_metric: i.target_metric, plan: i.plan, parent_idea_id: i.id, created_by: me.id }).select("id").single();
          await db.from("board_ideas").update({ decision: "iterate", updated_at: now }).eq("id", i.id); return NextResponse.json({ ok: true, id: data?.id });
        }
        return NextResponse.json({ error: "Unknown decision." }, { status: 400 });
      }
      default: return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Request failed." }, { status: 500 }); }
}
