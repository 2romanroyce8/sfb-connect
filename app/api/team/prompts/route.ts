import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { listCards, createCard, reorder, markSent, undoSent, PROMPT_FILES_BUCKET, isUrgency } from "@/lib/crm/promptQueue";
import { notifyAtlas } from "@/lib/crm/notifyAtlas";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE = 25 * 1024 * 1024;

async function caller() {
  const supabase = createSupabaseServerClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return null;
  const { data: me } = await supabase.from("users").select("id, full_name, email, team_role").eq("id", user.id).single();
  return me?.team_role ? (me as { id: string; full_name: string | null; email: string; team_role: string }) : null;
}
const UUID = /^[0-9a-f-]{36}$/i;

/** GET ?view=queue|sent — the whole tab's data in one call. */
export async function GET(req: NextRequest) {
  const me = await caller(); if (!me) return NextResponse.json({ error: "Team access required." }, { status: 403 });
  const service = createSupabaseServiceClient();
  const [queue, sent] = await Promise.all([listCards(service, "queued"), listCards(service, "sent")]);
  return NextResponse.json({ queue, sent });
}

/**
 * POST multipart/form-data: name, prompt_text, urgency, send_order?, files[] — create a card (manual).
 * POST application/json: { action: "reorder", id, to } | { action: "done", id } | { action: "undo", id } | { action: "update", id, name?, prompt_text?, urgency? }
 */
export async function POST(req: NextRequest) {
  const me = await caller(); if (!me) return NextResponse.json({ error: "Team access required." }, { status: 403 });
  const service = createSupabaseServiceClient(); const label = me.full_name || me.email;
  try {
    const ct = req.headers.get("content-type") ?? "";
    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      const card = await createCard(service, { name: String(form.get("name") ?? ""), prompt_text: String(form.get("prompt_text") ?? ""), urgency: form.get("urgency"), send_order: form.get("send_order"), created_by: me.id, created_by_label: label, source: "manual" });
      const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
      for (const f of files) {
        if (f.size > MAX_FILE) return NextResponse.json({ error: `${f.name} is over 25 MB.`, card }, { status: 413 });
        const path = `${card.id}/${Date.now()}-${f.name.replace(/[^\w.\-]+/g, "_")}`;
        const { error } = await service.storage.from(PROMPT_FILES_BUCKET).upload(path, Buffer.from(await f.arrayBuffer()), { contentType: f.type || undefined, upsert: false });
        if (error) throw new Error(`Upload failed for ${f.name}: ${error.message}`);
        await service.from("prompt_card_files").insert({ card_id: card.id, filename: f.name, storage_path: path, size_bytes: f.size, mime_type: f.type || null });
      }
      return NextResponse.json({ ok: true, card: (await listCards(service, "queued")).find((c) => c.id === card.id) ?? card });
    }
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    // Bulk (multi-select): queued cards only — sent prompts are append-only history (DB trigger).
    if (body.action === "bulk_delete" || body.action === "bulk_done") {
      const ids = (Array.isArray(body.ids) ? (body.ids as string[]) : []).filter((x) => UUID.test(x)).slice(0, 200);
      const { data: q } = await service.from("prompt_cards").select("id").eq("status", "queued").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      const qids = (q ?? []).map((x) => x.id as string);
      if (body.action === "bulk_done") { for (const id of qids) await markSent(service, id); }
      else if (qids.length) {
        const { data: files } = await service.from("prompt_card_files").select("storage_path").in("card_id", qids);
        if (files?.length) await service.storage.from(PROMPT_FILES_BUCKET).remove(files.map((f) => f.storage_path as string));
        const { error } = await service.from("prompt_cards").delete().in("id", qids); if (error) throw new Error(error.message);
      }
      return NextResponse.json({ ok: true, count: qids.length, queue: await listCards(service, "queued"), sent: await listCards(service, "sent") });
    }
    // Notify Atlas: one high-priority atlas task (updated, not duplicated, within 5 min). "notify_muse" kept as an alias.
    if (body.action === "notify_atlas" || body.action === "notify_muse") return NextResponse.json({ ok: true, ...(await notifyAtlas(service, { label })) });
    const id = typeof body.id === "string" && UUID.test(body.id) ? body.id : null; if (!id) return NextResponse.json({ error: "Missing card id." }, { status: 400 });
    switch (body.action) {
      case "reorder": await reorder(service, id, Number(body.to)); return NextResponse.json({ ok: true, queue: await listCards(service, "queued") });
      case "done": return NextResponse.json({ ok: true, card: await markSent(service, id), queue: await listCards(service, "queued") });
      case "undo": return NextResponse.json({ ok: true, card: await undoSent(service, id), queue: await listCards(service, "queued") });
      case "update": {
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (typeof body.name === "string" && body.name.trim().length >= 2) patch.name = body.name.trim().slice(0, 200);
        if (typeof body.prompt_text === "string" && body.prompt_text.trim()) patch.prompt_text = body.prompt_text.replace(/\r\n/g, "\n");
        if (isUrgency(body.urgency)) patch.urgency = body.urgency;
        const { error } = await service.from("prompt_cards").update(patch).eq("id", id).eq("status", "queued"); if (error) throw new Error(error.message);
        return NextResponse.json({ ok: true, queue: await listCards(service, "queued") });
      }
      default: return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Request failed." }, { status: 400 }); }
}
