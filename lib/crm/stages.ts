// The ONE list of pipeline stages (audit 2026-10-19). The Pipeline board,
// Leads list, dashboard table and stage API all read this, so a stage the
// app writes (e.g. meeting_completed after a demo) can never fall off the
// board again. Order = left-to-right on the board.
export type StageDef = { value: string; label: string; color: string; manual: boolean };

export const PIPELINE_STAGES: StageDef[] = [
  { value: "demo_requested", label: "Book Demo (Pending)", color: "var(--hx-ffd60a)", manual: false },
  { value: "new", label: "New", color: "var(--hx-46b5ff)", manual: true },
  { value: "researching", label: "Researching", color: "var(--hx-6e7bff)", manual: true },
  { value: "ready_to_call", label: "Ready to Call", color: "var(--hx-30d158)", manual: true },
  { value: "contacted", label: "Contacted", color: "var(--hx-20c7b7)", manual: true },
  { value: "interested", label: "Interested", color: "var(--hx-5ac8fa)", manual: true },
  { value: "follow_up", label: "Follow-Up", color: "var(--hx-ff9f0a)", manual: true },
  { value: "meeting_booked", label: "Meeting Booked", color: "var(--hx-bf5af2)", manual: true },
  { value: "meeting_completed", label: "Demo Done", color: "var(--hx-ff6ad5)", manual: true },
  { value: "proposal", label: "Proposal", color: "var(--hx-ff9f0a)", manual: true },
  { value: "won", label: "Won", color: "var(--hx-30d158)", manual: true },
  { value: "lost", label: "Lost", color: "var(--hx-ff453a)", manual: true },
  { value: "nurture", label: "Nurture", color: "var(--hx-6e6e73)", manual: true },
];

export const STAGE_LABEL: Record<string, string> = Object.fromEntries(PIPELINE_STAGES.map((s) => [s.value, s.label]));
export const STAGE_COLOR: Record<string, string> = Object.fromEntries(PIPELINE_STAGES.map((s) => [s.value, s.color]));
/** Stages a rep may move a lead into by hand (board drag / stage API). */
export const MANUAL_STAGES: string[] = PIPELINE_STAGES.filter((s) => s.manual).map((s) => s.value);
export const stageLabel = (v: string | null | undefined) => (v ? STAGE_LABEL[v] ?? v.replace(/_/g, " ") : "—");
