// Pure, client-safe rule shared by the per-row button, the bulk action and the API (no node imports).
/** Can a sequence be started for this prospect? Returns the reason it can't, or null. */
export function startSequenceBlocker(p: { email: string | null; status: string }): string | null {
  if (!p.email) return "no email yet";
  if (p.status === "in_sequence") return "already in a sequence";
  if (p.status === "unsubscribed") return "unsubscribed";
  return null;
}
