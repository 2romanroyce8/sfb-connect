import { createClient } from "@supabase/supabase-js";
import type { ModuleStatus } from "./config";

export type AgentModule = { key: string; position: number; name: string; status: ModuleStatus; tagline: string; description: string; updated_at?: string };

// Shipped defaults: used only if the table cannot be read, so the public
// page never renders empty. The database is the source of truth.
export const DEFAULT_MODULES: AgentModule[] = [
  { key: "ai_presence", position: 1, name: "AI Presence", status: "live", tagline: "Found first, chosen first.", description: "Your business recommended by ChatGPT, Perplexity, Gemini and Claude — presence score, verified sources, review signals." },
  { key: "outbound_gtm", position: 2, name: "Outbound / GTM", status: "unlocking_next", tagline: "Finds buyers, books calls.", description: "Finds buyers, enriches them, writes and follows up, and books calls — email and LinkedIn." },
  { key: "meta_ads", position: 3, name: "Meta Ads", status: "roadmap", tagline: "Managed for return.", description: "Paid ads managed for ROAS: creative testing, retargeting, full-funnel." },
  { key: "website", position: 4, name: "Website", status: "roadmap", tagline: "Convert the traffic you earn.", description: "Homepage, speed, payments, backlinks, SEO." },
  { key: "crm_automations", position: 5, name: "CRM + Automations", status: "roadmap", tagline: "Never forget a lead.", description: "Pipeline, follow-up, reminders, missed-call textback — GoHighLevel-friendly." },
  { key: "chat_texting", position: 6, name: "Chat & Texting", status: "roadmap", tagline: "Answers, qualifies, books.", description: "Website chat and SMS agent that qualifies and books." },
  { key: "reviews_reputation", position: 7, name: "Reviews & Reputation", status: "roadmap", tagline: "Earn it, watch it, answer it.", description: "Review generation, monitoring and responses." },
  { key: "sops", position: 8, name: "SOPs", status: "roadmap", tagline: "Your operations, documented.", description: "Operations documentation — the playbook your business runs on." },
];

/** Sorted by position; the roadmap position shown to customers is derived
 * from this order, never stored separately. */
export function sortModules(mods: AgentModule[]): AgentModule[] {
  return [...mods].sort((a, b) => a.position - b.position);
}

/** 1-based position among the NOT-yet-live modules ("3rd on the roadmap"). */
export function roadmapPosition(mods: AgentModule[], key: string): number | null {
  const pending = sortModules(mods).filter((m) => m.status !== "live");
  const i = pending.findIndex((m) => m.key === key);
  return i === -1 ? null : i + 1;
}

export async function fetchAgentModules(): Promise<AgentModule[]> {
  try {
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    const { data, error } = await anon.from("agent_program_modules").select("key, position, name, status, tagline, description, updated_at").order("position");
    if (error || !data || data.length === 0) return DEFAULT_MODULES;
    return sortModules(data as AgentModule[]);
  } catch {
    return DEFAULT_MODULES;
  }
}
