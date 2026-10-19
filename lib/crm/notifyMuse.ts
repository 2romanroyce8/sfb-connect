// "Notify Muse" (Give HyperAgent tab, 2026-10-19): tells Atlas (Muse) that
// Rome has sent every queued prompt. Mechanism: a high-priority agent task
// owned by atlas — durable, shows in Atlas's list_tasks loop, fires the
// task.created integration event (webhooks), and is visible on the board —
// plus a thread message addressed to atlas so it lands in Atlas's inbox too.
// A second click within 10 minutes reuses the open task instead of stacking.
import type { SupabaseClient } from "@supabase/supabase-js";
import { createTask, sendMessage } from "@/lib/agent/tasks/queue";
import { listCards } from "./promptQueue";
import { formatAge, waitedBeforeSend } from "./promptTiming";

export const MUSE_TASK_TITLE = "HyperAgent prompts complete — verify";
const REUSE_MS = 10 * 60_000;

export async function notifyMuse(service: SupabaseClient, by: { label: string }) {
  const nowIso = new Date().toISOString();
  const [queue, sent] = await Promise.all([listCards(service, "queued"), listCards(service, "sent")]);
  const since = new Date(Date.now() - 24 * 3600e3).toISOString();
  const recent = sent.filter((c) => c.sent_at && c.sent_at >= since);

  const { data: existing } = await service.from("agent_tasks").select("id, created_at, status").eq("owner_agent", "atlas").eq("title", MUSE_TASK_TITLE).in("status", ["open", "claimed", "in_progress"]).gte("created_at", new Date(Date.now() - REUSE_MS).toISOString()).order("created_at", { ascending: false }).limit(1).maybeSingle();

  const lines = recent.map((c) => { const w = waitedBeforeSend(c.created_at, c.sent_at); return `- #${c.send_order} ${c.name} — sent ${c.sent_at}${w != null ? ` (after ${formatAge(w)} in queue)` : ""}`; });
  const context = [
    `${by.label} clicked "Notify Muse" on /team/prompts at ${nowIso}: all HyperAgent prompts are sent and everything is good to go.`,
    "",
    `Queue now: ${queue.length} card${queue.length === 1 ? "" : "s"} still queued${queue.length ? ` (${queue.map((c) => `#${c.send_order} ${c.name}`).join("; ")})` : ""}.`,
    `Sent in the last 24h (${recent.length}):`,
    ...(lines.length ? lines : ["- none"]),
    "",
    "Acceptance: check HyperAgent's results for each sent prompt, then post_result (or close_task) here.",
  ].join("\n");

  let taskId: string, reused = false;
  if (existing) { taskId = existing.id as string; reused = true; }
  else { const t = await createTask("roman", { title: MUSE_TASK_TITLE, owner_agent: "atlas", priority: "high", requires_review: false, context }); taskId = t.id; }
  await sendMessage("roman", taskId, reused ? `Notify Muse clicked again at ${nowIso} — still good to go.\n\n${context}` : `All HyperAgent prompts are sent and everything is good to go. Details are in the task brief.`, "atlas");
  return { taskId, reused, queued: queue.length, sentLast24h: recent.length, notifiedAt: nowIso };
}
