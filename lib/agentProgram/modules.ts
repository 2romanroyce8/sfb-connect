import { createClient } from "@supabase/supabase-js";
import type { ModuleStatus } from "./config";

export type AgentModule = { key: string; position: number; name: string; status: ModuleStatus; tagline: string; description: string; updated_at?: string };

// Shipped defaults: used only if the table cannot be read, so the public
// page never renders empty. The database is the source of truth.
export const DEFAULT_MODULES: AgentModule[] = [
  { key: "ai_presence", position: 1, name: "AI Presence", status: "live", tagline: "Found first, chosen first.", description: "Gets your business recommended by AI assistants — presence score, verified sources, review signals." },
  { key: "chat_agent", position: 2, name: "Chat Agent", status: "unlocking_next", tagline: "Answers, qualifies, books.", description: "AI texting and website chat that answers customers, qualifies leads and books appointments." },
  { key: "crm_automations", position: 3, name: "Backend: CRM + Automations", status: "roadmap", tagline: "Never forget a lead.", description: "Every lead captured, followed up and never forgotten — pipeline, reminders, review requests." },
  { key: "website", position: 4, name: "Website", status: "roadmap", tagline: "Convert the traffic you earn.", description: "Homepage, speed, payments, backlinks — a site that converts the traffic the agent earns." },
  { key: "meta_ads", position: 5, name: "Meta Ads (ROAS)", status: "roadmap", tagline: "Paid reach, measured by return.", description: "Paid ads managed for return, with creative testing and retargeting." },
  { key: "sops", position: 6, name: "SOPs", status: "roadmap", tagline: "Your operations, documented.", description: "The playbook your business runs on — written down, kept current." },
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
