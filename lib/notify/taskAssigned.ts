// Assignee notifications (Roman, 2026-10-12): when a task's assignee is set or
// changed to a team member, that person is told — text + email + in-app on the
// same rails as owner alerts (lib/notify/ownerAlerts.ts): text and email until
// they tap "I received it", then text only; in-app always. Fires only for
// people newly added; the person doing the assigning is never notified about
// their own action.
import type { SupabaseClient } from "@supabase/supabase-js";
import { alertOwners } from "./ownerAlerts";

export type TaskRef = { kind: "work_plan_item" | "project_task" | "project_subtask"; id: string; title: string; url: string };

/** Pure: who is newly assigned. Order preserved, deduped, assigner excluded, blanks dropped. */
export function newlyAssigned(previous: readonly (string | null | undefined)[], next: readonly (string | null | undefined)[], actorId: string | null): string[] {
  const before = new Set(previous.filter((x): x is string => !!x));
  const out: string[] = [];
  for (const id of next) if (id && !before.has(id) && id !== actorId && !out.includes(id)) out.push(id);
  return out;
}

const KIND_LABEL: Record<TaskRef["kind"], string> = { work_plan_item: "work plan item", project_task: "project task", project_subtask: "subtask" };

/** Fan out to each newly assigned person. Never throws; returns how many people were alerted. */
export async function notifyTaskAssigned(service: SupabaseClient, task: TaskRef, previous: readonly (string | null | undefined)[], next: readonly (string | null | undefined)[], assignedBy: { id: string | null; label: string }): Promise<number> {
  const ids = newlyAssigned(previous, next, assignedBy.id);
  if (!ids.length) return 0;
  const title = task.title.replace(/\s+/g, " ").trim().slice(0, 120) || "(untitled)";
  const kind = KIND_LABEL[task.kind];
  const url = task.url.startsWith("http") ? task.url : `https://www.sfbconnect.com${task.url}`;
  try {
    await alertOwners(service, {
      trigger: "task_assigned", userIds: ids,
      sms: `New ${kind} for you: "${title}" - assigned by ${assignedBy.label}. ${url}`,
      email: { subject: `Assigned to you: ${title}`, html: `<p><strong>${assignedBy.label}</strong> assigned you a ${kind}:</p><p style="font-size:18px"><strong>${title.replace(/</g, "&lt;")}</strong></p><p><a href="${url}">Open it</a></p>`, text: `${assignedBy.label} assigned you a ${kind}: ${title}\n${url}` },
      inApp: { type: "owner_task_assigned", title: `Assigned to you: ${title}`, body: `${kind} · by ${assignedBy.label}`, actionUrl: task.url, actionLabel: "Open" },
      detail: { task_kind: task.kind, task_id: task.id, assigned_by: assignedBy.id },
    });
  } catch (e) { console.error("[task-assigned] alert failed:", e instanceof Error ? e.message : e); }
  return ids.length;
}
