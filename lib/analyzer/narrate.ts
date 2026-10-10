// Status-aware narration. The "your agent would…" line on every row is driven
// by the capability registry (agent_program_modules — the same source the
// integrations page and /agent read). Live → the agent does it. Not shipped →
// "takes this over when X ships — you're first in line." Never a promise of
// execution for an unshipped capability.
import type { AgentModule } from "@/lib/agentProgram/modules";
import { capability } from "@/lib/agentProgram/config";
import type { CheckKey, Finding } from "./types";

export type DayRow = {
  check: CheckKey;
  dayLabel: string;
  title: string;
  capabilityName: string;
  live: boolean;
  finding: Finding | null; // null while streaming
  /** What the agent does about it — status-aware. Null until the finding lands. */
  agentLine: string | null;
};

export const DAY_PLAN: { check: CheckKey; dayLabel: string; title: string }[] = [
  { check: "presence", dayLabel: "Days 1–2", title: "AI Presence" },
  { check: "outbound", dayLabel: "Days 3–4", title: "Outbound" },
  { check: "reviews", dayLabel: "Day 5", title: "Reviews" },
  { check: "website", dayLabel: "Day 6", title: "Website" },
  { check: "chat", dayLabel: "Day 7", title: "Chat" },
];

const LIVE_LINES: Record<CheckKey, (f: Finding) => string> = {
  presence: (f) => { const n = Number(f.metrics.issues ?? 0); return n > 0 ? `Your agent fixes all ${n} on day 1.` : "Your agent keeps it that way — it re-checks every week."; },
  outbound: (f) => Number(f.metrics.prospects ?? 0) > 0 ? "Your agent builds the list and writes the first sequence." : "Your agent asks you for your ideal customer on day 1, then builds the list.",
  reviews: (f) => Number(f.metrics.unanswered ?? 0) > 0 ? "Your agent responds to every one." : "Your agent answers every new review within a day.",
  website: (f) => f.items.length > 0 ? "Your agent ships them." : "Nothing urgent — your agent keeps watching speed and SEO.",
  chat: (f) => f.metrics.hasChat ? "Your agent takes over the chat and books to your calendar." : "Your agent answers 24/7 and books to your calendar.",
};

export function agentLine(check: CheckKey, finding: Finding, modules: AgentModule[]): string {
  const capKey = finding.capability;
  const mod = modules.find((m) => m.key === capKey);
  const name = mod?.name ?? capability(capKey)?.name ?? capKey;
  const live = mod?.status === "live";
  if (finding.status === "missing") {
    return live ? `Your agent gets the data you connect on day 1 and finishes this check.` : `Your agent takes this over when ${name} ships — you're first in line.`;
  }
  return live ? LIVE_LINES[check](finding) : `Your agent takes this over when ${name} ships — you're first in line.`;
}

export function buildRows(findings: Finding[], modules: AgentModule[]): DayRow[] {
  return DAY_PLAN.map((d) => {
    const f = findings.find((x) => x.check === d.check) ?? null;
    const capKey = f?.capability ?? CHECK_CAPABILITY[d.check];
    const mod = modules.find((m) => m.key === capKey);
    return { ...d, capabilityName: mod?.name ?? capability(capKey)?.name ?? capKey, live: mod?.status === "live", finding: f, agentLine: f ? agentLine(d.check, f, modules) : null };
  });
}

export const CHECK_CAPABILITY: Record<CheckKey, Finding["capability"]> = { presence: "ai_presence", outbound: "outbound_gtm", reviews: "reviews_reputation", website: "website", chat: "chat_texting" };

/** The trial's "first 3 tasks": top findings on LIVE capabilities only, most issues first. */
export function firstThreeTasks(findings: Finding[], modules: AgentModule[]): { title: string; context: string }[] {
  const live = new Set(modules.filter((m) => m.status === "live").map((m) => m.key));
  const score = (f: Finding) => Number(f.metrics.issues ?? f.metrics.prospects ?? f.metrics.unanswered ?? f.items.length ?? 0);
  const eligible = findings.filter((f) => f.status === "found" && live.has(f.capability)).sort((a, b) => score(b) - score(a));
  const tasks: { title: string; context: string }[] = [];
  for (const f of eligible) {
    const items = f.items.length ? f.items : [f.headline];
    for (const it of items) { if (tasks.length >= 3) break; tasks.push({ title: `${DAY_PLAN.find((d) => d.check === f.check)?.title ?? f.check}: ${it}`.slice(0, 200), context: `From the visitor's 7-day preview. ${f.headline} Sources: ${f.sources.join(", ")}.` }); }
    if (tasks.length >= 3) break;
  }
  return tasks;
}
