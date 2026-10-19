// "Give HyperAgent" queue — shared logic for the team API and the agent tool (Roman, 2026-10-18).
// Writes go through the service role so the append-only rule for sent cards lives in one place.
import type { SupabaseClient } from "@supabase/supabase-js";

export type Urgency = "high" | "medium" | "low";
export const URGENCIES: Urgency[] = ["high", "medium", "low"];
export const UNDO_WINDOW_MS = 10_000;
export const PROMPT_FILES_BUCKET = "prompt-files";
export const CARD_COLS = "id, name, prompt_text, urgency, send_order, status, sent_at, created_by, created_by_label, source, created_at, updated_at";

export type PromptCard = { id: string; name: string; prompt_text: string; urgency: Urgency; send_order: number; status: "queued" | "sent"; sent_at: string | null; created_by: string | null; created_by_label: string; source: "manual" | "agent"; created_at: string; updated_at: string; files: PromptFile[] };
export type PromptFile = { id: string; card_id: string; filename: string; size_bytes: number; mime_type: string | null; created_at: string };

export const isUrgency = (v: unknown): v is Urgency => typeof v === "string" && (URGENCIES as string[]).includes(v);

export async function listCards(service: SupabaseClient, status: "queued" | "sent"): Promise<PromptCard[]> {
  const q = service.from("prompt_cards").select(CARD_COLS).eq("status", status);
  const { data, error } = status === "queued" ? await q.order("send_order", { ascending: true }).order("created_at", { ascending: true }) : await q.order("sent_at", { ascending: false });
  if (error) throw new Error(error.message);
  const cards = (data ?? []) as Omit<PromptCard, "files">[];
  const ids = cards.map((c) => c.id);
  const { data: files } = ids.length ? await service.from("prompt_card_files").select("id, card_id, filename, size_bytes, mime_type, created_at").in("card_id", ids).order("created_at") : { data: [] as PromptFile[] };
  const byCard = new Map<string, PromptFile[]>(); for (const f of (files ?? []) as PromptFile[]) (byCard.get(f.card_id) ?? byCard.set(f.card_id, []).get(f.card_id)!).push(f);
  return cards.map((c) => ({ ...c, files: byCard.get(c.id) ?? [] }));
}

/** Next free send_order = max + 1 among queued cards. */
export async function nextSendOrder(service: SupabaseClient): Promise<number> {
  const { data } = await service.from("prompt_cards").select("send_order").eq("status", "queued").order("send_order", { ascending: false }).limit(1).maybeSingle();
  return ((data?.send_order as number | undefined) ?? 0) + 1;
}

export async function createCard(service: SupabaseClient, input: { name: string; prompt_text: string; urgency?: unknown; send_order?: unknown; created_by: string | null; created_by_label: string; source: "manual" | "agent" }): Promise<PromptCard> {
  const name = input.name.trim().slice(0, 200); const text = input.prompt_text.replace(/\r\n/g, "\n");
  if (name.length < 2) throw new Error("Give the card a name.");
  if (!text.trim()) throw new Error("The prompt text is empty.");
  const urgency: Urgency = isUrgency(input.urgency) ? input.urgency : "medium";
  const wanted = Number(input.send_order);
  const order = Number.isInteger(wanted) && wanted >= 1 ? wanted : await nextSendOrder(service);
  // Inserting at an occupied position shifts later cards down, so the order stays dense and explicit.
  await shiftFrom(service, order, null);
  const { data, error } = await service.from("prompt_cards").insert({ name, prompt_text: text, urgency, send_order: order, created_by: input.created_by, created_by_label: input.created_by_label, source: input.source }).select(CARD_COLS).single();
  if (error || !data) throw new Error(error?.message || "Could not create the card.");
  return { ...(data as Omit<PromptCard, "files">), files: [] };
}

async function shiftFrom(service: SupabaseClient, order: number, exceptId: string | null) {
  let q = service.from("prompt_cards").select("id, send_order").eq("status", "queued").gte("send_order", order).order("send_order", { ascending: false });
  if (exceptId) q = q.neq("id", exceptId);
  const { data } = await q;
  for (const r of (data ?? []) as { id: string; send_order: number }[]) await service.from("prompt_cards").update({ send_order: r.send_order + 1, updated_at: new Date().toISOString() }).eq("id", r.id);
}

/** Reorder: move a card to a position; everything is renumbered 1..n so the display is always dense. */
export async function reorder(service: SupabaseClient, id: string, toPosition: number): Promise<void> {
  const { data } = await service.from("prompt_cards").select("id").eq("status", "queued").order("send_order", { ascending: true }).order("created_at", { ascending: true });
  const ids = ((data ?? []) as { id: string }[]).map((r) => r.id).filter((x) => x !== id);
  if (!ids.length && !data?.some((r) => r.id === id)) throw new Error("Card not found.");
  const pos = Math.min(Math.max(1, Math.floor(toPosition)), ids.length + 1);
  ids.splice(pos - 1, 0, id);
  for (let i = 0; i < ids.length; i++) await service.from("prompt_cards").update({ send_order: i + 1, updated_at: new Date().toISOString() }).eq("id", ids[i]);
}

export async function renumber(service: SupabaseClient): Promise<void> {
  const { data } = await service.from("prompt_cards").select("id").eq("status", "queued").order("send_order", { ascending: true }).order("created_at", { ascending: true });
  const ids = ((data ?? []) as { id: string }[]).map((r) => r.id);
  for (let i = 0; i < ids.length; i++) await service.from("prompt_cards").update({ send_order: i + 1 }).eq("id", ids[i]);
}

/** Done: one click, no confirmation. Returns the sent card. */
export async function markSent(service: SupabaseClient, id: string): Promise<PromptCard> {
  const { data, error } = await service.from("prompt_cards").update({ status: "sent", sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id).eq("status", "queued").select(CARD_COLS).maybeSingle();
  if (error) throw new Error(error.message); if (!data) throw new Error("Card not found or already sent.");
  await renumber(service);
  return { ...(data as Omit<PromptCard, "files">), files: [] };
}

/** Undo within 10 s: the card returns to the queue at the end (its old slot may be taken). The DB trigger refuses anything later. */
export async function undoSent(service: SupabaseClient, id: string): Promise<PromptCard> {
  const { data: cur } = await service.from("prompt_cards").select("sent_at, status").eq("id", id).maybeSingle();
  if (!cur || cur.status !== "sent") throw new Error("Nothing to undo.");
  if (Date.now() - Date.parse(cur.sent_at as string) > UNDO_WINDOW_MS) throw new Error("The undo window has passed — sent prompts are history.");
  const order = await nextSendOrder(service);
  const { data, error } = await service.from("prompt_cards").update({ status: "queued", sent_at: null, send_order: order, updated_at: new Date().toISOString() }).eq("id", id).select(CARD_COLS).single();
  if (error || !data) throw new Error(error?.message || "Undo failed.");
  return { ...(data as Omit<PromptCard, "files">), files: [] };
}
