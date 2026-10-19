// Board Room ⇄ Campaigns core loop. Pure (tested): idea → plan → campaign draft → results → back to the idea.
export type IdeaStatus = "draft" | "ready" | "tested" | "killed";
export type Decision = "scale" | "iterate" | "kill";
export type CampaignStatus = "draft" | "running" | "paused" | "completed";
export type Plan = { what: string; who: string; success: string; duration_days: number; channels: string[]; audience_tag: string | null };
export type Idea = { id: string; title: string; description: string | null; target_metric: string | null; status: IdeaStatus; plan: Plan | null };
export type Metrics = { sends: number; opens: number; replies: number; calls: number; booked: number; won: number; revenue: number };

export const IDEA_STATUS_LABEL: Record<IdeaStatus, string> = { draft: "Draft", ready: "Ready to test", tested: "Tested", killed: "Killed" };
export const CHANNELS = ["email", "calls", "sms", "social", "in_person"] as const;
export const EMPTY_METRICS: Metrics = { sends: 0, opens: 0, replies: 0, calls: 0, booked: 0, won: 0, revenue: 0 };

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

/** Plan validation: everything the campaign needs to run and be judged. */
export function planProblems(p: Partial<Plan> | null | undefined): string[] {
  const out: string[] = [];
  if (!p?.what?.trim()) out.push("What are we testing?");
  if (!p?.who?.trim()) out.push("Who is it for?");
  if (!p?.success?.trim()) out.push("What does success look like?");
  if (!p?.duration_days || p.duration_days < 1 || p.duration_days > 90) out.push("Run length (1–90 days)");
  if (!p?.channels?.length) out.push("At least one channel");
  return out;
}

/** The campaign draft "Send to Campaigns" creates. Carries the whole plan; nothing runs until someone starts it. */
export function campaignDraftFromIdea(idea: Idea, now: Date = new Date()) {
  const p = idea.plan!;
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const end = new Date(start.getTime() + (p.duration_days - 1) * 864e5);
  return {
    name: idea.title.slice(0, 120), idea_id: idea.id, status: "draft" as CampaignStatus,
    hypothesis: p.what, audience: p.who, success_criteria: p.success, target_metric: idea.target_metric,
    channels: p.channels, audience_tag: p.audience_tag || `campaign-${slug(idea.title)}`,
    start_date: start.toISOString().slice(0, 10), end_date: end.toISOString().slice(0, 10), plan_snapshot: p,
  };
}

const rate = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);

/** Winner = best reply rate for email variants (booked as tie-break), else most booked. Needs ≥ 20 sends each for an email call. */
export function pickWinner(variants: { id: string; name: string; m: Metrics }[]): { id: string | null; reason: string } {
  if (variants.length < 2) return { id: variants[0]?.id ?? null, reason: variants.length ? "Only one variant." : "No variants." };
  const email = variants.filter((v) => v.m.sends > 0);
  if (email.length >= 2) {
    if (email.some((v) => v.m.sends < 20)) return { id: null, reason: "Not enough sends yet (need 20+ per variant)." };
    const s = [...email].sort((a, b) => (rate(b.m.replies, b.m.sends) ?? 0) - (rate(a.m.replies, a.m.sends) ?? 0) || b.m.booked - a.m.booked);
    if ((rate(s[0].m.replies, s[0].m.sends) ?? 0) === (rate(s[1].m.replies, s[1].m.sends) ?? 0) && s[0].m.booked === s[1].m.booked) return { id: null, reason: "Tied so far." };
    return { id: s[0].id, reason: `${s[0].name}: ${rate(s[0].m.replies, s[0].m.sends)}% reply rate vs ${rate(s[1].m.replies, s[1].m.sends)}%.` };
  }
  const s = [...variants].sort((a, b) => b.m.booked - a.m.booked || b.m.won - a.m.won);
  if (s[0].m.booked === s[1].m.booked && s[0].m.won === s[1].m.won) return { id: null, reason: "Tied so far." };
  return { id: s[0].id, reason: `${s[0].name}: ${s[0].m.booked} booked vs ${s[1].m.booked}.` };
}

/** The summary pushed back to the Board Room idea card when a campaign completes. */
export function resultSummary(c: { name: string; start_date: string | null; end_date: string | null; success_criteria: string | null }, m: Metrics, outcome: "hit" | "missed" | "inconclusive", winner: { name: string; reason: string } | null, notes: string): string {
  const parts = [
    `${c.name} (${c.start_date ?? "?"} → ${c.end_date ?? "?"}): ${outcome === "hit" ? "HIT the goal" : outcome === "missed" ? "MISSED the goal" : "Inconclusive"}${c.success_criteria ? ` — goal: ${c.success_criteria}` : ""}.`,
    `Sends ${m.sends} · opens ${m.opens}${m.sends ? ` (${rate(m.opens, m.sends)}%)` : ""} · replies ${m.replies}${m.sends ? ` (${rate(m.replies, m.sends)}%)` : ""} · calls ${m.calls} · booked ${m.booked} · closed ${m.won}${m.revenue ? ` ($${m.revenue.toLocaleString()})` : ""}.`,
    winner ? `Winner: ${winner.name} — ${winner.reason}` : null,
    notes.trim() ? `Notes: ${notes.trim()}` : null,
  ];
  return parts.filter(Boolean).join("\n");
}

export const addMetrics = (a: Metrics, b: Metrics): Metrics => ({ sends: a.sends + b.sends, opens: a.opens + b.opens, replies: a.replies + b.replies, calls: a.calls + b.calls, booked: a.booked + b.booked, won: a.won + b.won, revenue: a.revenue + b.revenue });
