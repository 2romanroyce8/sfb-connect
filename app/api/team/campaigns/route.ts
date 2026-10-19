import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { teamCaller, SETUP_MSG, missingTable } from "@/lib/boardroom/auth";
import { campaignMetrics, type VariantRow } from "@/lib/boardroom/metrics";
import { pickWinner, resultSummary, CHANNELS } from "@/lib/boardroom/loop";
import { LIBRARY } from "@/lib/outbound/presets";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type C = { id: string; idea_id: string | null; name: string; status: string; audience_tag: string | null; start_date: string | null; end_date: string | null; created_at: string; success_criteria: string | null; [k: string]: unknown };

export async function GET(req: NextRequest) {
  const me = await teamCaller(); if (!me) return NextResponse.json({ error: "Team access required." }, { status: 403 });
  const db = createSupabaseServiceClient(); const id = req.nextUrl.searchParams.get("id");
  if (id) {
    const { data: c, error } = await db.from("campaigns").select("*").eq("id", id).maybeSingle();
    if (missingTable(error)) return NextResponse.json({ setupNeeded: true, message: SETUP_MSG });
    if (!c) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    const [{ data: variants }, { data: idea }, { data: saved }, { count: audience }] = await Promise.all([
      db.from("campaign_variants").select("*").eq("campaign_id", id).order("created_at"),
      c.idea_id ? db.from("board_ideas").select("id, title, status, result_summary, plan").eq("id", c.idea_id).maybeSingle() : Promise.resolve({ data: null }),
      db.from("outbound_templates").select("id, name").eq("archived", false).order("created_at", { ascending: false }).limit(50),
      c.audience_tag ? db.from("crm_leads").select("id", { count: "exact", head: true }).contains("tags", [c.audience_tag]) : Promise.resolve({ count: 0 }),
    ]);
    const vs = (variants ?? []) as VariantRow[];
    const metrics = await campaignMetrics(db, c as C, vs);
    const winner = pickWinner(vs.map((v) => ({ id: v.id, name: v.name, m: metrics.perVariant.find((p) => p.id === v.id)!.m })));
    const templates = [...LIBRARY.map((p) => ({ key: p.key, name: p.name })), ...(saved ?? []).map((t) => ({ key: `saved:${t.id}`, name: `Saved: ${t.name}` }))];
    return NextResponse.json({ campaign: c, variants: vs, idea, metrics, winner, templates, audienceCount: audience ?? 0, channels: CHANNELS });
  }
  const { data: list, error } = await db.from("campaigns").select("*").order("created_at", { ascending: false }).limit(100);
  if (missingTable(error)) return NextResponse.json({ setupNeeded: true, message: SETUP_MSG });
  const ideaIds = Array.from(new Set((list ?? []).map((c) => c.idea_id).filter(Boolean))) as string[];
  const { data: ideas } = ideaIds.length ? await db.from("board_ideas").select("id, title").in("id", ideaIds) : { data: [] };
  const title = new Map((ideas ?? []).map((i) => [i.id as string, i.title as string]));
  const rows = await Promise.all((list ?? []).map(async (c) => {
    const m = c.status === "completed" && c.result_metrics ? c.result_metrics : c.status === "draft" ? null : (await campaignMetrics(db, c as C, ((await db.from("campaign_variants").select("*").eq("campaign_id", c.id)).data ?? []) as VariantRow[])).total;
    return { ...c, idea_title: c.idea_id ? title.get(c.idea_id) ?? null : null, metrics: m };
  }));
  return NextResponse.json({ campaigns: rows });
}

export async function POST(req: NextRequest) {
  const me = await teamCaller(); if (!me) return NextResponse.json({ error: "Team access required." }, { status: 403 });
  const db = createSupabaseServiceClient();
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const s = (k: string, max = 4000) => (typeof b[k] === "string" ? (b[k] as string).trim().slice(0, max) : "");
  const now = new Date().toISOString(); const today = now.slice(0, 10);
  const get = async (id: string) => (await db.from("campaigns").select("*").eq("id", id).maybeSingle()).data as C | null;
  try {
    switch (b.action) {
      case "update": {
        const patch: Record<string, unknown> = { updated_at: now };
        for (const k of ["name", "hypothesis", "audience", "success_criteria", "target_metric", "messaging"]) if (typeof b[k] === "string") patch[k] = s(k) || null;
        if (typeof b.audience_tag === "string") patch.audience_tag = s("audience_tag").toLowerCase().replace(/[^a-z0-9-]/g, "") || null;
        for (const k of ["start_date", "end_date"]) if (typeof b[k] === "string") patch[k] = /^\d{4}-\d{2}-\d{2}$/.test(s(k)) ? s(k) : null;
        if (Array.isArray(b.channels)) patch.channels = (b.channels as string[]).filter((c) => (CHANNELS as readonly string[]).includes(c));
        await db.from("campaigns").update(patch).eq("id", s("id")).neq("status", "completed"); return NextResponse.json({ ok: true });
      }
      case "set_status": {
        const c = await get(s("id")); if (!c) return NextResponse.json({ error: "Not found." }, { status: 404 });
        const to = s("status"); const ok: Record<string, string[]> = { draft: ["running"], running: ["paused"], paused: ["running"] };
        if (!ok[c.status]?.includes(to)) return NextResponse.json({ error: `Can't go from ${c.status} to ${to}.` }, { status: 400 });
        await db.from("campaigns").update({ status: to, start_date: to === "running" && (!c.start_date || c.start_date > today) && c.status === "draft" ? today : c.start_date, updated_at: now }).eq("id", c.id);
        return NextResponse.json({ ok: true });
      }
      case "add_variant": { const { error } = await db.from("campaign_variants").insert({ campaign_id: s("id"), name: s("name", 80) || "New variant" }); return NextResponse.json(error ? { error: error.message } : { ok: true }); }
      case "update_variant": {
        const patch: Record<string, unknown> = {};
        for (const k of ["name", "template_key", "subject", "body", "notes"]) if (typeof b[k] === "string") patch[k] = s(k) || null;
        if (typeof b.lead_tag === "string") patch.lead_tag = s("lead_tag").toLowerCase().replace(/[^a-z0-9-]/g, "") || null;
        await db.from("campaign_variants").update(patch).eq("id", s("variant_id")); return NextResponse.json({ ok: true });
      }
      case "delete_variant": await db.from("campaign_variants").delete().eq("id", s("variant_id")); return NextResponse.json({ ok: true });
      case "add_audience": {
        // CRM integration: put the campaign tag on existing leads that carry a source tag (e.g. roofing-pilot), optionally only one state/stage.
        const c = await get(s("id")); if (!c?.audience_tag) return NextResponse.json({ error: "Set the campaign's audience tag first." }, { status: 400 });
        let q = db.from("crm_leads").select("id, tags").eq("archived", false).contains("tags", [s("source_tag").toLowerCase()]);
        if (s("stage")) q = q.eq("pipeline_stage", s("stage"));
        const { data: leads } = await q.limit(2000); let added = 0;
        for (const l of leads ?? []) { const t = new Set<string>((l.tags as string[]) ?? []); if (t.has(c.audience_tag)) continue; t.add(c.audience_tag); await db.from("crm_leads").update({ tags: Array.from(t), updated_at: now }).eq("id", l.id); added++; }
        return NextResponse.json({ ok: true, added });
      }
      case "split_audience": {
        // A/B for calls: alternate the campaign's leads across the variants' lead tags (each variant gets <campaign-tag>-<a|b|…> if unset).
        const c = await get(s("id")); if (!c?.audience_tag) return NextResponse.json({ error: "Set the audience tag first." }, { status: 400 });
        const { data: vs } = await db.from("campaign_variants").select("id, lead_tag").eq("campaign_id", c.id).order("created_at");
        if (!vs || vs.length < 2) return NextResponse.json({ error: "Add at least two variants." }, { status: 400 });
        const tags = vs.map((v, i) => (v.lead_tag as string) || `${c.audience_tag}-${String.fromCharCode(97 + i)}`);
        for (let i = 0; i < vs.length; i++) if (!vs[i].lead_tag) await db.from("campaign_variants").update({ lead_tag: tags[i] }).eq("id", vs[i].id);
        const { data: leads } = await db.from("crm_leads").select("id, tags").contains("tags", [c.audience_tag]).order("created_at").limit(2000);
        let n = 0; for (const l of leads ?? []) { const cur = ((l.tags as string[]) ?? []).filter((t) => !tags.includes(t)); cur.push(tags[n % tags.length]); await db.from("crm_leads").update({ tags: cur, updated_at: now }).eq("id", l.id); n++; }
        return NextResponse.json({ ok: true, split: n, tags });
      }
      case "complete": {
        const c = await get(s("id")); if (!c) return NextResponse.json({ error: "Not found." }, { status: 404 });
        if (c.status === "completed") return NextResponse.json({ error: "Already completed." }, { status: 400 });
        const outcome = ["hit", "missed", "inconclusive"].includes(s("outcome")) ? (s("outcome") as "hit" | "missed" | "inconclusive") : null;
        if (!outcome) return NextResponse.json({ error: "Pick an outcome: hit, missed or inconclusive." }, { status: 400 });
        const vs = ((await db.from("campaign_variants").select("*").eq("campaign_id", c.id)).data ?? []) as VariantRow[];
        const m = await campaignMetrics(db, { ...c, status: "running" }, vs);
        const winnerId = s("winner_variant_id") || null; const w = winnerId ? vs.find((v) => v.id === winnerId) : null;
        const auto = pickWinner(vs.map((v) => ({ id: v.id, name: v.name, m: m.perVariant.find((p) => p.id === v.id)!.m })));
        const summary = resultSummary(c, m.total, outcome, w ? { name: w.name, reason: auto.id === w.id ? auto.reason : "chosen by the team" } : null, s("notes"));
        await db.from("campaigns").update({ status: "completed", outcome, result_notes: s("notes") || null, result_metrics: { ...m.total, perVariant: m.perVariant }, winner_variant_id: w?.id ?? null, completed_at: now, end_date: c.end_date && c.end_date < today ? c.end_date : today, updated_at: now }).eq("id", c.id);
        if (c.idea_id) await db.from("board_ideas").update({ status: "tested", result_summary: summary, last_campaign_id: c.id, decision: null, updated_at: now }).eq("id", c.idea_id);
        return NextResponse.json({ ok: true, summary });
      }
      case "save_winner_template": {
        // Wins become templates: the winning variant's copy is saved as an outbound template on SFB Connect's own business.
        const c = await get(s("id")); const { data: v } = await db.from("campaign_variants").select("*").eq("id", s("variant_id")).maybeSingle();
        if (!c || !v) return NextResponse.json({ error: "Not found." }, { status: 404 });
        if (!v.subject || !v.body) return NextResponse.json({ error: "This variant has no subject/body copy to save. Add its copy first." }, { status: 400 });
        const { data: house } = await db.from("businesses").select("id").eq("is_house_account", true).limit(1).maybeSingle();
        if (!house) return NextResponse.json({ error: "No SFB Connect house business found." }, { status: 400 });
        const { error } = await db.from("outbound_templates").insert({ business_id: house.id, name: `Winner: ${c.name} — ${v.name}`.slice(0, 80), category: "custom", subject: String(v.subject).slice(0, 300), body: String(v.body).slice(0, 6000), created_by: me.full_name || me.email });
        return NextResponse.json(error ? { error: error.message } : { ok: true });
      }
      default: return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Request failed." }, { status: 500 }); }
}
