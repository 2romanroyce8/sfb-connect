// "Move to next stage" for the Pipeline board (Roman, 2026-10-22). Pure + tested.
// The forward path is the board's left-to-right order up to Proposal. Won is never auto-entered (it records a revenue
// event and needs the plan sold — set per lead), and Won/Lost/Nurture are not on the forward path.
export const FORWARD_PATH = ["demo_requested", "new", "researching", "ready_to_call", "contacted", "interested", "follow_up", "meeting_booked", "meeting_completed", "proposal"] as const;

export function nextStageOf(stage: string): { next: string } | { blocked: string } {
  const i = (FORWARD_PATH as readonly string[]).indexOf(stage);
  if (i === -1) return { blocked: "no next stage from here" };
  if (i === FORWARD_PATH.length - 1) return { blocked: "next is Won — set it per lead (needs the plan sold)" };
  return { next: FORWARD_PATH[i + 1] };
}

/** Group lead ids by the stage they should move to; leads with no valid next stage are reported, never moved. */
export function planNextStage(leads: { id: string; stage: string }[]): { moves: Record<string, string[]>; blocked: { id: string; reason: string }[] } {
  const moves: Record<string, string[]> = {}; const blocked: { id: string; reason: string }[] = [];
  for (const l of leads) { const r = nextStageOf(l.stage); if ("next" in r) (moves[r.next] ??= []).push(l.id); else blocked.push({ id: l.id, reason: r.blocked }); }
  return { moves, blocked };
}
