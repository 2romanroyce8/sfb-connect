// "What We Analyze" (THE SCOPE) — the five scan dimensions, one per check.
// Copy is Roman's (2026-10-10). The action line is status-aware: it reads the
// capability registry, so an unshipped capability never promises execution.
import type { AgentModule } from "@/lib/agentProgram/modules";
import { capability } from "@/lib/agentProgram/config";
import { CHECK_CAPABILITY } from "./narrate";
import type { CheckKey } from "./types";

export const SCOPE: { check: CheckKey; title: string; scans: string; liveAction: string }[] = [
  { check: "presence", title: "AI Presence", scans: "Visibility score across AI engines, listing errors, citation gaps.", liveAction: "Your agent fixes every error it finds." },
  { check: "outbound", title: "Outbound", scans: "Prospects matching your ICP in your market, right now.", liveAction: "Your agent builds the list and writes the first sequence." },
  { check: "reviews", title: "Reviews", scans: "Unanswered reviews, your rating vs nearby competitors.", liveAction: "Your agent responds to every one." },
  { check: "website", title: "Website", scans: "Speed, SEO basics, booking and contact friction.", liveAction: "Your agent ships the 3 quickest wins." },
  { check: "chat", title: "Chat", scans: "After-hours coverage gap — when your leads message vs when you answer.", liveAction: "Your agent answers 24/7 and books to your calendar." },
];

export function scopeAction(check: CheckKey, modules: AgentModule[]): { line: string; live: boolean } {
  const capKey = CHECK_CAPABILITY[check];
  const mod = modules.find((m) => m.key === capKey);
  const live = mod?.status === "live";
  const name = mod?.name ?? capability(capKey)?.name ?? capKey;
  const item = SCOPE.find((s) => s.check === check)!;
  return { live, line: live ? item.liveAction : `Your agent takes this over when ${name} ships — you're first in line.` };
}
