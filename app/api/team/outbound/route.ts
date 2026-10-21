import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { addProspect, approveMessage, bookMeeting, draftMessage, enrichProspect, importFindings, OutboundError, proposeMeetingSlots, rejectMessage, sendApprovedMessage, retryFailedSend, startSequence, syncReplies, advanceSequences, InsufficientCreditsError } from "@/lib/outbound/engine";
import { startSequenceBlocker } from "@/lib/outbound/sequenceRules";
import type { TemplateKey } from "@/lib/outbound/templates";
import { listLibrary, pickIntro, saveTemplate, archiveTemplate } from "@/lib/outbound/library";
import { ASSIST_INSTRUCTIONS, type AssistKey } from "@/lib/outbound/assist";
import { assistStatus, assistEditLogged } from "@/lib/outbound/assistSpend";
import { previewCsv, importProspects } from "@/lib/outbound/importProspects";
import type { ImportField } from "@/lib/outbound/csvImport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Team-side outbound workspace API (owners and assigned overseers). Every
 * write goes through the engine, so credits and the approval gate apply
 * here exactly as they do for the agent and the cron.
 */
async function caller() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: me } = await supabase.from("users").select("id, full_name, email, team_role").eq("id", user.id).single();
  if (!me?.team_role) return null;
  return me as { id: string; full_name: string | null; email: string; team_role: string };
}
const mayManage = (me: { id: string; team_role: string }, b: { owner_id: string; agent_overseer_id: string | null }) => me.team_role === "owner" || b.owner_id === me.id || b.agent_overseer_id === me.id;

export async function GET(req: NextRequest) {
  const me = await caller();
  if (!me) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const service = createSupabaseServiceClient();
  const { data: bizRows } = await service.from("businesses").select("id, legal_name, owner_id, agent_overseer_id, plan_key, outbound_offer_line, outbound_time_zone").not("plan_key", "is", null).order("created_at", { ascending: false });
  const businesses = (bizRows ?? []).filter((b) => mayManage(me, b));
  const businessId = req.nextUrl.searchParams.get("business") || businesses[0]?.id || null;
  if (!businessId || !businesses.some((b) => b.id === businessId)) return NextResponse.json({ businesses, business: null });
  const [p, m, e, bk, f, bal, imps] = await Promise.all([
    service.from("outbound_prospects").select("*").eq("business_id", businessId).order("updated_at", { ascending: false }).limit(200),
    service.from("outbound_messages").select("*").eq("business_id", businessId).order("created_at", { ascending: false }).limit(200),
    service.from("outbound_events").select("*").eq("business_id", businessId).order("created_at", { ascending: false }).limit(100),
    service.from("outbound_bookings").select("*").eq("business_id", businessId).order("start_at", { ascending: false }).limit(50),
    service.from("research_feed_findings").select("id, business_name, website, city, state, category, identity_label, created_at").eq("accepted", true).order("created_at", { ascending: false }).limit(50),
    service.rpc("get_credit_breakdown", { p_business_id: businessId }),
    service.from("outbound_imports").select("id, filename, uploaded_by, counts, created_at").eq("business_id", businessId).order("created_at", { ascending: false }).limit(20),
  ]);
  const breakdown = Array.isArray(bal.data) ? bal.data[0] : bal.data;
  return NextResponse.json({ businesses, business: businesses.find((b) => b.id === businessId), prospects: p.data ?? [], messages: m.data ?? [], events: e.data ?? [], bookings: bk.data ?? [], findings: f.data ?? [], credits: breakdown ?? null, imports: imps.data ?? [] });
}

export async function POST(req: NextRequest) {
  const me = await caller();
  if (!me) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const service = createSupabaseServiceClient();
  const actor = { kind: "user" as const, id: me.id, label: me.full_name || me.email };
  const s = (k: string) => (typeof body[k] === "string" ? (body[k] as string).trim() : "");
  try {
    // Resolve + authorize the business for every action.
    let businessId = s("business_id");
    if (!businessId && s("prospect_id")) { const { data } = await service.from("outbound_prospects").select("business_id").eq("id", s("prospect_id")).maybeSingle(); businessId = data?.business_id ?? ""; }
    if (!businessId && s("message_id")) { const { data } = await service.from("outbound_messages").select("business_id").eq("id", s("message_id")).maybeSingle(); businessId = data?.business_id ?? ""; }
    const { data: b } = await service.from("businesses").select("id, owner_id, agent_overseer_id").eq("id", businessId).maybeSingle();
    if (!b || !mayManage(me, b)) return NextResponse.json({ error: "Not allowed for this business." }, { status: 403 });

    switch (s("action")) {
      case "set_offer_line": {
        const line = s("offer_line").slice(0, 300);
        await service.from("businesses").update({ outbound_offer_line: line || null, updated_at: new Date().toISOString() }).eq("id", b.id);
        return NextResponse.json({ ok: true });
      }
      case "add_prospect": return NextResponse.json({ prospect: await addProspect(service, { businessId: b.id, name: s("name"), website: s("website") || null, email: s("email") || null, phone: s("phone") || null, city: s("city") || null, state: s("state") || null, category: s("category") || null, contactName: s("contact_name") || null }, actor) });
      case "import_findings": return NextResponse.json({ results: await importFindings(service, b.id, Array.isArray(body.finding_ids) ? (body.finding_ids as string[]).slice(0, 50) : [], actor) });
      // CSV list upload (team side, same engine as the customer's step 7). 0 credits.
      case "import_csv_preview": { const r = previewCsv(s("csv")); if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 }); return NextResponse.json({ ok: true, preview: r }); }
      case "import_csv": {
        const r = await importProspects(service, { businessId: b.id, filename: s("filename") || "upload.csv", csv: typeof body.csv === "string" ? body.csv : "", mapping: (body.mapping && typeof body.mapping === "object" ? body.mapping : {}) as Record<string, ImportField> }, { kind: "user", id: me.id, label: actor.label });
        if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
        return NextResponse.json({ ok: true, ...r });
      }
      case "enrich": return NextResponse.json(await enrichProspect(service, s("prospect_id"), actor));
      case "start_sequences": {
        // Bulk (Roman, 2026-10-21): the client sends ≤25 ids per request and loops, so no request outlives the function limit.
        // Drafts into the approval queue only (2 credits each); nothing is sent. Stops at the first out-of-credits and says so.
        const ids = (Array.isArray(body.prospect_ids) ? (body.prospect_ids as unknown[]) : []).filter((x): x is string => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x)).slice(0, 25);
        if (!ids.length) return NextResponse.json({ error: "Select at least one prospect." }, { status: 400 });
        const { data: ps } = await service.from("outbound_prospects").select("id, name, email, status").eq("business_id", b.id).in("id", ids);
        const found = new Map((ps ?? []).map((x) => [x.id as string, x as { id: string; name: string; email: string | null; status: string }]));
        const ov = s("template") ? { template: s("template"), custom: (body.custom as { subject: string; body: string } | undefined) ?? null } : null;
        const results: { id: string; name: string; status: "started" | "skipped" | "error" | "not_attempted"; reason?: string }[] = []; let stopped = false;
        for (const id of ids) {
          const p = found.get(id);
          if (!p) { results.push({ id, name: "(not in this business)", status: "skipped", reason: "not found in this business" }); continue; }
          if (stopped) { results.push({ id, name: p.name, status: "not_attempted", reason: "stopped — out of credits" }); continue; }
          const why = startSequenceBlocker(p); if (why) { results.push({ id, name: p.name, status: "skipped", reason: why }); continue; }
          try { await startSequence(service, id, actor, ov); results.push({ id, name: p.name, status: "started" }); }
          catch (e) {
            if (e instanceof InsufficientCreditsError) { stopped = true; results.push({ id, name: p.name, status: "error", reason: "out of credits" }); }
            else results.push({ id, name: p.name, status: "error", reason: e instanceof Error ? e.message.slice(0, 160) : "failed" });
          }
        }
        return NextResponse.json({ ok: true, results, stoppedForCredits: stopped });
      }
      case "start_sequence": {
        // Ownership check: the prospect must belong to the business this caller was authorized for.
        const { data: owned } = await service.from("outbound_prospects").select("id").eq("id", s("prospect_id")).eq("business_id", b.id).maybeSingle();
        if (!owned) return NextResponse.json({ error: "Prospect not found for this business." }, { status: 404 });
        return NextResponse.json({ message: await startSequence(service, s("prospect_id"), actor, s("template") ? { template: s("template"), custom: (body.custom as { subject: string; body: string } | undefined) ?? null } : null) }); }
      case "draft": return NextResponse.json({ message: await draftMessage(service, { prospectId: s("prospect_id"), template: (s("template") || "intro") as TemplateKey, custom: (body.custom as { subject: string; body: string } | undefined) ?? null, slots: s("slots") || null }, actor) });
      // Template library (2026-10-12)
      case "template_library": { const [library, assist] = await Promise.all([listLibrary(service, b.id), assistStatus(service)]); return NextResponse.json({ ok: true, library, assist }); }
      case "template_pick": { const key = s("template") || null; await pickIntro(service, b.id, key); return NextResponse.json({ ok: true, key }); }
      case "template_assist": { const ins = ASSIST_INSTRUCTIONS.some((i) => i.key === body.instruction) ? (body.instruction as AssistKey) : "shorter"; try { return NextResponse.json({ ok: true, edited: await assistEditLogged(service, { businessId: b.id, userId: me.id, label: actor.label }, { subject: s("subject"), body: typeof body.body === "string" ? body.body : "" }, ins) }); } catch (e) { if (e instanceof OutboundError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status }); return NextResponse.json({ error: e instanceof Error ? e.message : "Editing help failed." }, { status: 502 }); } }
      case "template_save": return NextResponse.json({ ok: true, template: await saveTemplate(service, b.id, { name: s("name"), messageId: s("message_id") || null, subject: s("subject") || undefined, body: typeof body.body === "string" ? body.body : undefined, category: body.category === "saved" ? "saved" : "custom" }, { label: actor.label }) });
      case "template_archive": await archiveTemplate(service, b.id, s("template_id")); return NextResponse.json({ ok: true });
      case "approve": return NextResponse.json({ message: await approveMessage(service, s("message_id"), { id: me.id, label: actor.label }, { andSend: body.and_send !== false, note: s("note") || undefined }) });
      case "reject": return NextResponse.json({ message: await rejectMessage(service, s("message_id"), { id: me.id, label: actor.label }, s("reason") || "Rejected by reviewer") });
      case "send": return NextResponse.json({ message: await sendApprovedMessage(service, s("message_id"), actor) });
      case "retry": return NextResponse.json({ message: await retryFailedSend(service, s("message_id"), actor) });
      case "slots": return NextResponse.json(await proposeMeetingSlots(service, b.id));
      case "book": return NextResponse.json(await bookMeeting(service, { prospectId: s("prospect_id"), startISO: s("start"), endISO: s("end"), replyToMessageId: s("message_id") || null }, actor));
      case "sync": { const r = await syncReplies(service, b.id); const a = await advanceSequences(service, b.id, actor); return NextResponse.json({ ...r, ...a }); }
      default: return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
  } catch (e) {
    if (e instanceof OutboundError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    if (e instanceof InsufficientCreditsError) return NextResponse.json({ error: e.message, code: "insufficient_credits" }, { status: 402 });
    console.error("[outbound]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Something failed on our side. It was logged." }, { status: 500 });
  }
}
