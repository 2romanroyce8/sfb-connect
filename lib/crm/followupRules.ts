// Outcome → follow-up rule (approved by Rome 2026-10-19).
//   no answer (and voicemail — nobody picked up)              → +2 days
//   no close: interested, call back later, demo completed
//   without a won deal                                         → +3 days
// A booked meeting or a won deal is a close: no automatic follow-up.
// When the rep picks a follow-up time themselves, theirs wins; the rule only
// fills the gap when they leave it blank. Pure, so it is unit-tested.

export type FollowupRuleKey = "no_answer" | "voicemail" | "interested" | "call_back_later" | "demo_no_close";

export const FOLLOWUP_RULE_DAYS: Record<FollowupRuleKey, number> = {
  no_answer: 2,
  voicemail: 2,
  interested: 3,
  call_back_later: 3,
  demo_no_close: 3,
};

const LABEL: Record<FollowupRuleKey, string> = {
  no_answer: "no answer",
  voicemail: "voicemail",
  interested: "interested, no close yet",
  call_back_later: "call back later",
  demo_no_close: "demo completed without close",
};

export const isRuleOutcome = (o: string): o is FollowupRuleKey => o in FOLLOWUP_RULE_DAYS;

/** Due time for an automatic follow-up: exactly N days after `from` (same time of day). Null when the outcome has no rule. */
export function ruleDueAt(outcome: string, from: Date = new Date()): Date | null {
  if (!isRuleOutcome(outcome)) return null;
  return new Date(from.getTime() + FOLLOWUP_RULE_DAYS[outcome] * 24 * 3600e3);
}

export function ruleReason(outcome: FollowupRuleKey): string {
  return `Auto follow-up: ${LABEL[outcome]} (+${FOLLOWUP_RULE_DAYS[outcome]} days)`;
}

/** A demo marked completed is a "no close" unless the lead is already won. */
export const demoIsNoClose = (pipelineStageBefore: string | null | undefined) => pipelineStageBefore !== "won";

/** Skip creating an automatic follow-up when the lead already has an open one scheduled in the future. */
export const hasUpcomingOpen = (rows: { status: string | null; due_at: string | null }[], now: Date = new Date()) =>
  rows.some((r) => r.status === "open" && !!r.due_at && new Date(r.due_at).getTime() > now.getTime());
