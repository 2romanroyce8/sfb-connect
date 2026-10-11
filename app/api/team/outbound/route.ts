import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { addProspect, approveMessage, bookMeeting, draftMessage, enrichProspect, importFindings, OutboundError, proposeMeetingSlots, rejectMessage, sendApprovedMessage, startSequence, syncReplies, advanceSequences, InsufficientCreditsError } from "@/lib/outbound/engine";
import type { TemplateKey } from "@/lib/outbound/templates";

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
  const { data: bizRows } = await service.from("businesses").select("id, legal_name, owner_id, agent_overseer_id, is_sandbox, plan_key, outbound_offer_line, outbound_time_zone").not("plan_key", "is", null).order("created_at", { ascending: false });
  const businesses = (bizRows ?? []).filter((b) => mayManage(me, b));
  const businessId = req.nextUrl.searchParams.get("business") || businesses[0]?.id || null;
  if (!businessId || !businesses.some((b) => b.id === businessId)) return NextResponse.json({ businesses, business: null });
  const [p, m, e, bk, f, bal] = await Promise.all([
    service.from("outbound_prospects").select("*").eq("business_id", businessId).order("updated_at", { ascending: false }).limit(200),
    service.from("outbound_messages").select("*").eq("business_id", businessId).order("created_at", { ascending: false }).limit(200),
    service.from("outbound_events").select("*").eq("business_id", businessId).order("created_at", { ascending: false }).limit(100),
    service.from("outbound_bookings").select("*").eq("business_id", businessId).order("start_at", { ascending: false }).limit(50),
    service.from("research_feed_findings").select("id, business_name, website, city, state, category, identity_label, created_at").eq("accepted", true).order("created_at", { ascending: false }).limit(50),
    service.rpc("get_credit_breakdown", { p_business_id: businessId }),
  ]);
  const breakdown = Array.isArray(bal.data) ? bal.data[0] : bal.data;
  return NextResponse.json({ businesses, business: businesses.find((b) => b.id === businessId), prospects: p.data ?? [], messages: m.data ?? [], events: e.data ?? [], bookings: bk.data ?? [], findings: f.data ?? [], credits: breakdown ?? null });
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
      case "enrich": return NextResponse.json(await enrichProspect(service, s("prospect_id"), actor));
      case "start_sequence": return NextResponse.json({ message: await startSequence(service, s("prospect_id"), actor) });
      case "draft": return NextResponse.json({ message: await draftMessage(service, { prospectId: s("prospect_id"), template: (s("template") || "intro") as TemplateKey, slots: s("slots") || null }, actor) });
      case "approve": return NextResponse.json({ message: await approveMessage(service, s("message_id"), { id: me.id, label: actor.label }, { andSend: body.and_send !== false, note: s("note") || undefined }) });
      case "reject": return NextResponse.json({ message: await rejectMessage(service, s("message_id"), { id: me.id, label: actor.label }, s("reason") || "Rejected by reviewer") });
      case "send": return NextResponse.json({ message: await sendApprovedMessage(service, s("message_id"), actor) });
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
