import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAgencyContext } from "@/lib/agency/context";
import { planNext, type Stage } from "@/lib/agency/stages";
export const dynamic = "force-dynamic";

// Agency CRM actions. The agency comes from the signed-in membership; ids from the request are only ever used through the SESSION client,
// so RLS decides what each role can see or change (reps: own leads; managers/admins/owners: all). History is append-only.
const UUID = /^[0-9a-f-]{36}$/i;
const str = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const opt = (v: unknown, n: number) => str(v, n) || null;
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });
const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && UUID.test(x)).slice(0, 500) : []);

export async function POST(req: NextRequest) {
  const r = await getAgencyContext(); if (r.status !== "ok") return fail("Not signed in to an agency.", 401);
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>; const db = createSupabaseServerClient(); const ag = r.ctx.agencyId; const me = r.ctx.userId;
  const stagesQ = async () => ((await db.from("agy_pipeline_stages").select("key, label, position, is_won, is_lost").eq("agency_id", ag).order("position")).data ?? []) as Stage[];
  const act = (lead_id: string, kind: string, body: string) => db.from("agy_lead_activities").insert({ agency_id: ag, lead_id, kind, body, created_by: me });
  const moveLeads = async (leadIds: string[], toStage: string) => {
    const { data: cur } = await db.from("agy_leads").select("id, stage").eq("agency_id", ag).in("id", leadIds); const rows = (cur ?? []).filter((l) => l.stage !== toStage);
    if (!rows.length) return { moved: 0, unchanged: (cur ?? []).length };
    const { data: upd, error } = await db.from("agy_leads").update({ stage: toStage, updated_at: new Date().toISOString() }).eq("agency_id", ag).in("id", rows.map((x) => x.id as string)).select("id");
    if (error) throw new Error(error.message);
    const ok = new Set((upd ?? []).map((x) => x.id as string)); const from = new Map(rows.map((x) => [x.id as string, x.stage as string]));
    if (ok.size) await db.from("agy_lead_activities").insert([...ok].map((id) => ({ agency_id: ag, lead_id: id, kind: "stage_change", body: `${from.get(id)} → ${toStage}`, created_by: me })));
    return { moved: ok.size, unchanged: (cur ?? []).length - rows.length };
  };
  try {
    switch (b.action) {
      case "create": {
        const name = str(b.business_name, 160); if (name.length < 2) return fail("Business name is required.");
        const email = opt(b.email, 200); if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("That email isn't valid.");
        let site = opt(b.website, 300); if (site && !/^https?:\/\//i.test(site)) site = `https://${site}`;
        const dollars = Number(b.value); const value = Number.isFinite(dollars) && dollars > 0 ? Math.round(dollars * 100) : 0;
        const { data, error } = await db.from("agy_leads").insert({ agency_id: ag, business_name: name, contact_name: opt(b.contact_name, 120), email, phone: opt(b.phone, 40), website: site, city: opt(b.city, 80), source: opt(b.source, 80), value_cents: value, owner_id: me, created_by: me }).select("id").single();
        if (error) return fail(error.code === "23505" ? "A lead with that email already exists." : error.code === "42501" ? "Your role can't add leads." : error.message, error.code === "23505" ? 409 : 400);
        await act(data.id as string, "created", `Lead added${b.source ? ` (source: ${str(b.source, 80)})` : ""}`);
        return NextResponse.json({ ok: true, id: data.id });
      }
      case "stage": {
        const to = str(b.stage, 40); const st = await stagesQ(); if (!st.some((s) => s.key === to)) return fail("Unknown stage."); const list = ids(b.ids); if (!list.length) return fail("Select at least one lead.");
        return NextResponse.json({ ok: true, ...(await moveLeads(list, to)) });
      }
      case "next": {
        const list = ids(b.ids); if (!list.length) return fail("Select at least one lead."); const st = await stagesQ();
        const { data: cur } = await db.from("agy_leads").select("id, stage").eq("agency_id", ag).in("id", list);
        const p = planNext(st, (cur ?? []).map((l) => ({ id: l.id as string, stage: l.stage as string }))); let moved = 0;
        for (const [stage, group] of Object.entries(p.moves)) moved += (await moveLeads(group, stage)).moved;
        return NextResponse.json({ ok: true, moved, blocked: p.blocked.length, blockedReason: p.blocked[0]?.reason ?? null, notFound: list.length - (cur ?? []).length });
      }
      case "note": { const id = str(b.lead_id, 40), body = str(b.body, 4000); if (!UUID.test(id) || !body) return fail("Write a note first."); const { error } = await act(id, str(b.kind, 10) === "call" ? "call" : "note", body); if (error) return fail(error.code === "42501" ? "You can't add to that lead." : error.message, error.code === "42501" ? 403 : 400); return NextResponse.json({ ok: true }); }
      case "followup": {
        const id = str(b.lead_id, 40), title = str(b.title, 200), due = new Date(str(b.due_at, 40)); if (!UUID.test(id) || !title || Number.isNaN(due.getTime())) return fail("Add a title and a due date.");
        const { error } = await db.from("agy_followups").insert({ agency_id: ag, lead_id: id, title, due_at: due.toISOString(), assigned_to: me, created_by: me }); if (error) return fail(error.code === "42501" ? "You can't add to that lead." : error.message, error.code === "42501" ? 403 : 400);
        await act(id, "followup", `Follow-up set: ${title}`); return NextResponse.json({ ok: true });
      }
      case "done": { const id = str(b.followup_id, 40); if (!UUID.test(id)) return fail("Unknown follow-up."); const { data, error } = await db.from("agy_followups").update({ done_at: new Date().toISOString() }).eq("id", id).eq("agency_id", ag).is("done_at", null).select("id"); if (error) return fail(error.message); if (!data?.length) return fail("Follow-up not found.", 404); return NextResponse.json({ ok: true }); }
      case "update": {
        const id = str(b.lead_id, 40); if (!UUID.test(id)) return fail("Unknown lead.");
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if ("value" in b) { const d = Number(b.value); if (!Number.isFinite(d) || d < 0) return fail("Value must be a number."); patch.value_cents = Math.round(d * 100); }
        if ("expected_close" in b) { const v = str(b.expected_close, 10); if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return fail("Use a date like 2026-12-31."); patch.expected_close = v || null; }
        for (const k of ["contact_name", "phone", "city", "source"] as const) if (k in b) patch[k] = opt(b[k], 120);
        const { data, error } = await db.from("agy_leads").update(patch).eq("id", id).eq("agency_id", ag).select("id"); if (error) return fail(error.message); if (!data?.length) return fail("Lead not found.", 404); return NextResponse.json({ ok: true });
      }
      case "attach_demo": {
        const id = str(b.lead_id, 40), demo = str(b.demo_id, 40); if (!UUID.test(id) || !UUID.test(demo)) return fail("Pick a demo.");
        const { data: d } = await db.from("agy_demo_projects").select("id, business_name, status").eq("id", demo).eq("agency_id", ag).maybeSingle(); if (!d) return fail("Demo not found.", 404); if (d.status !== "published") return fail("Publish the demo first, so the link works.");
        const { data, error } = await db.from("agy_leads").update({ demo_id: demo, updated_at: new Date().toISOString() }).eq("id", id).eq("agency_id", ag).select("id, stage"); if (error) return fail(error.message); if (!data?.length) return fail("Lead not found.", 404);
        if (["new_lead", "contacted", "qualified"].includes(data[0].stage as string)) await moveLeads([id], "demo_sent");
        await act(id, "demo_sent", `Demo attached: ${d.business_name}`); return NextResponse.json({ ok: true });
      }
      case "archive": { const list = ids(b.ids); if (!list.length) return fail("Select at least one lead."); const { data, error } = await db.from("agy_leads").update({ archived: true, updated_at: new Date().toISOString() }).eq("agency_id", ag).in("id", list).select("id"); if (error) return fail(error.message); return NextResponse.json({ ok: true, archived: data?.length ?? 0 }); }
    }
    return fail("Unknown action.");
  } catch (e) { return fail(e instanceof Error ? e.message : "That didn't work.", 500); }
}
