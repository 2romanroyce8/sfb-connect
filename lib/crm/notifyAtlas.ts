// "Notify Atlas" (Give HyperAgent tab). Creates — or, within 5 minutes, updates — ONE high-priority task owned by
// the atlas handle, readable immediately via the agent API (list_tasks / get_task read agent_tasks directly; no cache).
// The key facts sit in the first 400 chars of the brief because list_tasks returns 400-char summaries.
import type { SupabaseClient } from "@supabase/supabase-js";
import { createTask, sendMessage } from "@/lib/agent/tasks/queue";
import { listCards } from "./promptQueue";

export const ATLAS_TASK_TITLE = "Notify Atlas: verify sent HyperAgent prompts";
export const ATLAS_CALL_TO_ACTION = "Rome pressed Notify Atlas - verify the sent prompts above and report back.";
export const DEDUPE_MS = 5 * 60_000;

export const fmtEt = (d: Date) => d.toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" }) + " ET";
export const fmtEtShort = (d: Date) => d.toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" });

/** Pure: the task brief. */
export function atlasBrief(at: Date, queued: { name: string; send_order: number }[], sent: { name: string; send_order: number; sent_at: string | null }[], by: string): string {
  return [
    `Pressed: ${fmtEt(at)} by ${by}`,
    `Queue: ${queued.length} · Sent Prompts: ${sent.length}`,
    `Sent prompts to verify: ${sent.length ? sent.map((c) => c.name).join("; ") : "(none)"}`,
    ATLAS_CALL_TO_ACTION,
    "",
    "Details:",
    ...sent.map((c) => `- #${c.send_order} ${c.name}${c.sent_at ? ` (sent ${fmtEt(new Date(c.sent_at))})` : ""}`),
    ...(queued.length ? ["", "Still in Queue (not yet sent):", ...queued.map((c) => `- #${c.send_order} ${c.name}`)] : []),
  ].join("\n");
}

export async function notifyAtlas(service: SupabaseClient, by: { label: string }, now = new Date()) {
  const [queue, sent] = await Promise.all([listCards(service, "queued"), listCards(service, "sent")]);
  const context = atlasBrief(now, queue, sent, by.label);
  const { data: existing } = await service.from("agent_tasks").select("id").eq("owner_agent", "atlas").eq("title", ATLAS_TASK_TITLE)
    .not("status", "in", "(done,rejected,canceled,closed)").gte("updated_at", new Date(now.getTime() - DEDUPE_MS).toISOString())
    .order("updated_at", { ascending: false }).limit(1).maybeSingle();
  let taskId: string; let updated = false;
  if (existing) {
    const { error } = await service.from("agent_tasks").update({ context, priority: "high", updated_at: now.toISOString() }).eq("id", existing.id);
    if (error) throw new Error(`Could not update the Atlas task: ${error.message}`);
    taskId = existing.id as string; updated = true;
  } else {
    taskId = (await createTask("roman", { title: ATLAS_TASK_TITLE, owner_agent: "atlas", priority: "high", requires_review: false, context })).id;
  }
  // Read back so the confirmation only shows once the task really exists for the agent API.
  const { data: check } = await service.from("agent_tasks").select("id, owner_agent, priority, status").eq("id", taskId).single();
  if (!check || check.owner_agent !== "atlas") throw new Error("The Atlas task didn't save.");
  await sendMessage("roman", taskId, updated ? `Notify Atlas pressed again at ${fmtEt(now)} — brief updated.` : ATLAS_CALL_TO_ACTION, "atlas").catch(() => null);
  return { taskId, updated, queued: queue.length, sent: sent.length, notifiedAt: now.toISOString(), notifiedAtLabel: fmtEtShort(now) };
}
