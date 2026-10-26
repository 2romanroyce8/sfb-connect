// Client-safe pipeline helpers (no server imports). Stages are per-agency data; this only decides "what is next".
export type Stage = { key: string; label: string; position: number; is_won: boolean; is_lost: boolean };
export const DEFAULT_STAGE_KEYS = ["new_lead", "contacted", "qualified", "demo_sent", "demo_viewed", "meeting_booked", "proposal_sent", "won", "lost"];

/** Next stage by position, skipping Lost (Lost is chosen deliberately, never advanced into). Won and Lost are terminal. */
export function nextStageKey(stages: Stage[], current: string): { next: string } | { blocked: string } {
  const sorted = [...stages].sort((a, b) => a.position - b.position); const i = sorted.findIndex((s) => s.key === current);
  if (i === -1) return { blocked: "unknown stage" };
  const cur = sorted[i]; if (cur.is_won || cur.is_lost) return { blocked: cur.is_won ? "already won" : "marked lost" };
  const nxt = sorted.slice(i + 1).find((s) => !s.is_lost); return nxt ? { next: nxt.key } : { blocked: "no next stage" };
}
export function planNext(stages: Stage[], leads: { id: string; stage: string }[]) {
  const moves: Record<string, string[]> = {}; const blocked: { id: string; reason: string }[] = [];
  for (const l of leads) { const r = nextStageKey(stages, l.stage); if ("next" in r) (moves[r.next] ??= []).push(l.id); else blocked.push({ id: l.id, reason: r.blocked }); }
  return { moves, blocked };
}
export const centsToUsd = (c: number) => `$${(c / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
