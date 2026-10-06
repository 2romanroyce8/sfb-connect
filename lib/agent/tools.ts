import type { AgentContext } from "./auth";
import { requireScope, AgentAuthError, appOrigin } from "./auth";
import { audit, issueBrowserHandoff } from "./store";
import type { NextRequest } from "next/server";
import { toOrFilterValue } from "@/lib/postgrestFilter";

// ============================================================
// SEMANTIC TOOLS
// One implementation serves both the MCP endpoint and the REST routes.
// Every handler runs on ctx.user -- a Supabase client carrying the
// authorizing user's own JWT -- so RLS answers "what may this user see",
// and the agent can never widen that. IDs supplied by the agent are never
// trusted: they are only ever used as filters under RLS.
// ============================================================

type JsonSchema = Record<string, unknown>;
export type ToolDef = {
  name: string;
  description: string;
  scope: import("./scopes").Scope;
  inputSchema: JsonSchema;
  outputSchema: JsonSchema;
  run: (ctx: AgentContext, args: Record<string, unknown>, req: NextRequest) => Promise<unknown>;
};

const str = (d: string) => ({ type: "string", description: d });
const int = (d: string, min = 1, max = 100) => ({ type: "integer", minimum: min, maximum: max, description: d });
const obj = (props: Record<string, unknown>, required: string[] = []) => ({ type: "object", properties: props, required, additionalProperties: false });

function fail(error: { message: string } | null, what: string) { if (error) throw new AgentAuthError(500, "query_failed", `${what}: ${error.message}`); }
function s(v: unknown) { return typeof v === "string" ? v.trim() : ""; }
function n(v: unknown, def: number, max = 100) { const x = typeof v === "number" ? v : parseInt(String(v ?? ""), 10); return Number.isFinite(x) ? Math.min(Math.max(1, x), max) : def; }

export const TOOLS: ToolDef[] = [
  {
    name: "get_sfb_workspace",
    description: "Who the agent is connected as: the authorizing user, their team role, the workspace, and the scopes granted. Call first to understand what you may access.",
    scope: "sfb:workspace:read",
    inputSchema: obj({}),
    outputSchema: obj({ user: obj({ id: str(""), email: str(""), full_name: str(""), team_role: str(""), team_status: str("") }), workspace: str(""), client: str(""), scopes: { type: "array", items: { type: "string" } }, access_level: str("") }),
    async run(ctx) {
      const { data, error } = await ctx.user.from("users").select("id, email, full_name, team_role, team_status").eq("id", ctx.userId).single();
      fail(error, "load user");
      return { user: data, workspace: ctx.authorization.workspace_label, client: ctx.clientId, scopes: [...ctx.scopes], access_level: [...ctx.scopes].some((x) => x.endsWith(":write") || x.endsWith(":start") || x.endsWith(":run")) ? "read-write" : "read-only" };
    },
  },
  {
    name: "get_sfb_team",
    description: "The team roster the user can see (owners see everyone; reps see themselves). Use for 'show me my team', 'who is on the team', 'who is active'.",
    scope: "sfb:team:read",
    inputSchema: obj({}),
    outputSchema: obj({ members: { type: "array", items: obj({ id: str(""), full_name: str(""), email: str(""), team_role: str(""), team_status: str(""), last_active_at: str("") }) } }),
    async run(ctx) {
      const { data, error } = await ctx.user.from("users").select("id, full_name, email, team_role, team_status, last_active_at, created_at").not("team_role", "is", null).order("created_at", { ascending: true });
      fail(error, "load team");
      return { members: data ?? [] };
    },
  },
  {
    name: "get_sfb_team_member",
    description: "One team member by id. Returns nothing the user could not see in the Team page.",
    scope: "sfb:team:read",
    inputSchema: obj({ member_id: str("users.id (uuid)") }, ["member_id"]),
    outputSchema: obj({ member: obj({}) }),
    async run(ctx, a) {
      const { data, error } = await ctx.user.from("users").select("id, full_name, email, team_role, team_status, last_active_at, created_at, home_timezone").eq("id", s(a.member_id)).maybeSingle();
      fail(error, "load member");
      if (!data) throw new AgentAuthError(404, "not_found", "No team member with that id is visible to this user.");
      return { member: data };
    },
  },
  {
    name: "search_sfb_leads",
    description: "Search leads by business name, phone, website or email, or list the newest leads when query is empty. Use for 'find my lead for X', 'show my newest leads'. Only leads this user can see are returned.",
    scope: "sfb:leads:read",
    inputSchema: obj({ query: str("Free text; empty lists newest first"), stage: str("Optional pipeline_stage filter"), include_archived: { type: "boolean" }, limit: int("Max rows", 1, 50) }),
    outputSchema: obj({ leads: { type: "array", items: obj({ id: str(""), business_name: str(""), phone: str(""), website: str(""), city: str(""), state: str(""), pipeline_stage: str(""), ai_overall_score: { type: ["integer", "null"] }, created_at: str("") }) } }),
    async run(ctx, a) {
      let q = ctx.user.from("crm_leads").select("id, business_name, phone, website, email, city, state, category, pipeline_stage, ai_overall_score, recommended_offer, assigned_rep, archived, created_at, updated_at").order("created_at", { ascending: false }).limit(n(a.limit, 20, 50));
      const text = s(a.query);
      if (text.length >= 2) { const term = toOrFilterValue(`%${text}%`); q = q.or(`business_name.ilike.${term},phone.ilike.${term},website.ilike.${term},email.ilike.${term}`); }
      if (s(a.stage)) q = q.eq("pipeline_stage", s(a.stage));
      if (!a.include_archived) q = q.eq("archived", false);
      const { data, error } = await q;
      fail(error, "search leads");
      return { leads: data ?? [] };
    },
  },
  {
    name: "get_sfb_lead",
    description: "Full lead record by id, with its research evidence summary, latest readiness audit score and recent pipeline history. Use after search_sfb_leads.",
    scope: "sfb:leads:read",
    inputSchema: obj({ lead_id: str("crm_leads.id (uuid)") }, ["lead_id"]),
    outputSchema: obj({ lead: obj({}), latest_audit: obj({}), pipeline_history: { type: "array" }, evidence_count: { type: "integer" } }),
    async run(ctx, a) {
      const id = s(a.lead_id);
      const { data: lead, error } = await ctx.user.from("crm_leads").select("*").eq("id", id).maybeSingle();
      fail(error, "load lead");
      if (!lead) throw new AgentAuthError(404, "not_found", "No lead with that id is visible to this user.");
      const [{ data: audit }, { data: hist }, { count }] = await Promise.all([
        ctx.user.from("crm_audits").select("id, overall_score, identity_score, knowledge_score, authority_score, location_score, machine_readability_score, created_at").eq("lead_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        ctx.user.from("crm_pipeline_history").select("from_stage, to_stage, changed_at, changed_by").eq("lead_id", id).order("changed_at", { ascending: false }).limit(10),
        ctx.user.from("crm_lead_evidence").select("id", { count: "exact", head: true }).eq("lead_id", id),
      ]);
      return { lead, latest_audit: audit ?? null, pipeline_history: hist ?? [], evidence_count: count ?? 0 };
    },
  },
  {
    name: "get_sfb_pipeline",
    description: "The active (non-archived) pipeline grouped by stage with counts. Use for 'what's in my pipeline', 'how many leads are ready to call'.",
    scope: "sfb:pipeline:read",
    inputSchema: obj({ limit_per_stage: int("Max leads returned per stage", 1, 50) }),
    outputSchema: obj({ stages: { type: "array", items: obj({ stage: str(""), count: { type: "integer" }, leads: { type: "array" } }) } }),
    async run(ctx, a) {
      const { data, error } = await ctx.user.from("crm_leads").select("id, business_name, phone, website, pipeline_stage, ai_overall_score, recommended_offer, assigned_rep, updated_at").eq("archived", false).order("updated_at", { ascending: false });
      fail(error, "load pipeline");
      const per = n(a.limit_per_stage, 10, 50);
      const groups = new Map<string, typeof data>();
      for (const l of data ?? []) { const k = l.pipeline_stage ?? "unknown"; if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(l); }
      return { stages: Array.from(groups.entries()).map(([stage, leads]) => ({ stage, count: leads!.length, leads: leads!.slice(0, per) })) };
    },
  },
  {
    name: "search_sfb_businesses",
    description: "Search researched businesses (Research Queue results) by name, website or phone -- pending, saved or discarded. Use for 'did we research X', 'show pending research'.",
    scope: "sfb:research:read",
    inputSchema: obj({ query: str("Free text; empty lists newest"), status: str("pending | saved | discarded"), limit: int("Max rows", 1, 50) }),
    outputSchema: obj({ businesses: { type: "array" } }),
    async run(ctx, a) {
      let q = ctx.user.from("crm_research_results").select("id, business_name, person_name, website, phone, email, city, state, category, status, research_status, identity_confidence, research_confidence_pct, entity_type, source_type, seed_display_name, created_at, converted_lead_id").order("created_at", { ascending: false }).limit(n(a.limit, 20, 50));
      const text = s(a.query);
      if (text.length >= 2) { const term = toOrFilterValue(`%${text}%`); q = q.or(`business_name.ilike.${term},website.ilike.${term},phone.ilike.${term},person_name.ilike.${term}`); }
      if (s(a.status)) q = q.eq("status", s(a.status));
      const { data, error } = await q;
      fail(error, "search businesses");
      return { businesses: data ?? [] };
    },
  },
  {
    name: "get_sfb_business_research",
    description: "The full verified research profile for a researched business (research result id): seed entity, identity, person/business/relationship, contacts, locations, socials, conflicts, limitations, sales intelligence. Use for 'open the research for X'.",
    scope: "sfb:research:read",
    inputSchema: obj({ research_id: str("crm_research_results.id (uuid)") }, ["research_id"]),
    outputSchema: obj({ research: obj({}), profile: obj({}) }),
    async run(ctx, a) {
      const id = s(a.research_id);
      const { data, error } = await ctx.user.from("crm_research_results").select("id, status, business_name, person_name, website, phone, email, city, state, category, services, description, research_status, identity_confidence, research_confidence_pct, entity_type, business_status, source_type, seed_platform, seed_platform_id, seed_display_name, conflicts, limitations, reconciled_profile, converted_lead_id, created_at, updated_at").eq("id", id).maybeSingle();
      fail(error, "load research");
      if (!data) throw new AgentAuthError(404, "not_found", "No research result with that id is visible to this user.");
      const { reconciled_profile, ...rest } = data as Record<string, unknown>;
      return { research: rest, profile: reconciled_profile ?? null };
    },
  },
  {
    name: "get_sfb_research_sources",
    description: "Every source the research engine touched for a result, with its entity-match verdict (MATCHED / PROBABLE / POSSIBLE / UNVERIFIED / REJECTED) and reasons. Use to explain where a fact came from or why something was rejected.",
    scope: "sfb:research:read",
    inputSchema: obj({ research_id: str("crm_research_results.id (uuid)") }, ["research_id"]),
    outputSchema: obj({ sources: { type: "array" } }),
    async run(ctx, a) {
      const id = s(a.research_id);
      const { data: r } = await ctx.user.from("crm_research_results").select("id").eq("id", id).maybeSingle();
      if (!r) throw new AgentAuthError(404, "not_found", "No research result with that id is visible to this user.");
      const { data, error } = await ctx.user.from("crm_research_sources").select("ordinal, url, platform, link_type, priority, is_first_party, association, discovery_method, fetch_status, links_to_seed, entity_match_status, entity_match_reasons, source_quality, source_entity_name").eq("research_result_id", id).order("ordinal");
      fail(error, "load sources");
      return { sources: data ?? [] };
    },
  },
  {
    name: "get_sfb_research_status",
    description: "Research jobs: currently running, recently completed and failed (with error codes). Use for 'is research still running', 'what failed'.",
    scope: "sfb:research:read",
    inputSchema: obj({ limit: int("Max jobs", 1, 50) }),
    outputSchema: obj({ jobs: { type: "array" } }),
    async run(ctx, a) {
      const { data, error } = await ctx.user.from("crm_research_jobs").select("id, started_for, status, current_step, progress_percent, sources_found, error_code, error_message, research_result_id, created_at, completed_at").order("created_at", { ascending: false }).limit(n(a.limit, 20, 50));
      fail(error, "load jobs");
      return { jobs: data ?? [] };
    },
  },
  {
    name: "get_sfb_business_audit",
    description: "The latest Business Readiness Audit for a lead (5 x 20 scoring: identity, knowledge, authority, location, machine readability) with per-category evidence and recommended fixes. This measures readiness to be found by AI, not current AI visibility.",
    scope: "sfb:audit:read",
    inputSchema: obj({ lead_id: str("crm_leads.id (uuid)") }, ["lead_id"]),
    outputSchema: obj({ audit: obj({}), categories: { type: "array" }, opportunity: obj({}) }),
    async run(ctx, a) {
      const id = s(a.lead_id);
      const { data: audit, error } = await ctx.user.from("crm_audits").select("*").eq("lead_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      fail(error, "load audit");
      if (!audit) throw new AgentAuthError(404, "not_found", "No audit exists for that lead, or the lead is not visible to this user.");
      const [{ data: cats }, { data: opp }] = await Promise.all([
        ctx.user.from("crm_audit_categories").select("category, score, reason, positive_evidence, negative_evidence, unknowns, recommended_fixes").eq("audit_id", audit.id),
        ctx.user.from("crm_opportunities").select("primary_offer, secondary_offer, confidence, reasoning, created_at").eq("lead_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      return { audit, categories: cats ?? [], opportunity: opp ?? null };
    },
  },
  {
    name: "get_sfb_ai_presence",
    description: "AI Presence for a customer business (businesses.id): latest presence scores and recent AI visibility observations (which AI systems mentioned the business). Only customer businesses the user may see. For a prospect lead, use get_sfb_business_audit instead.",
    scope: "sfb:ai_presence:read",
    inputSchema: obj({ business_id: str("businesses.id (uuid)") }, ["business_id"]),
    outputSchema: obj({ business: obj({}), scores: { type: "array" }, observations: { type: "array" } }),
    async run(ctx, a) {
      const id = s(a.business_id);
      const { data: biz, error } = await ctx.user.from("businesses").select("id, name, website, plan_key, created_at").eq("id", id).maybeSingle();
      fail(error, "load business");
      if (!biz) throw new AgentAuthError(404, "not_found", "No customer business with that id is visible to this user.");
      const [{ data: scores }, { data: obs }] = await Promise.all([
        ctx.user.from("presence_scores").select("*").eq("business_id", id).order("created_at", { ascending: false }).limit(12),
        ctx.user.from("ai_visibility_observations").select("*").eq("business_id", id).order("created_at", { ascending: false }).limit(25),
      ]);
      return { business: biz, scores: scores ?? [], observations: obs ?? [] };
    },
  },
  {
    name: "open_sfb_dashboard",
    description: "Creates a one-time, short-lived sign-in link that opens the REAL SFB Connect dashboard as the authorizing user in a browser (read-only delegated session). Use when the user asks to open SFB Connect, navigate the dashboard, or when no structured tool covers the task. The link expires in 2 minutes and works once.",
    scope: "sfb:browser",
    inputSchema: obj({ path: str("Dashboard path to land on, e.g. /team or /team/research (default /team/dashboard)") }),
    outputSchema: obj({ url: str("Open this URL in a browser within 2 minutes"), expires_in_seconds: { type: "integer" }, landing_path: str("") }),
    async run(ctx, a, req) {
      const path = s(a.path) || "/team/dashboard";
      if (!/^\/team(\/|$)/.test(path)) throw new AgentAuthError(400, "invalid_path", "Only /team paths can be opened.");
      const code = await issueBrowserHandoff(ctx.authorization.id);
      return { url: `${appOrigin(req)}/agent/session/${code}?next=${encodeURIComponent(path)}`, expires_in_seconds: 120, landing_path: path };
    },
  },
];

export const TOOL_BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));

export async function runTool(ctx: AgentContext, name: string, args: Record<string, unknown>, req: NextRequest, accessMethod: "api" | "mcp"): Promise<unknown> {
  const tool = TOOL_BY_NAME.get(name);
  if (!tool) throw new AgentAuthError(404, "unknown_tool", `Unknown tool ${name}.`);
  try {
    requireScope(ctx, tool.scope);
    const out = await tool.run(ctx, args ?? {}, req);
    await audit({ authorizationId: ctx.authorization.id, userId: ctx.userId, clientId: ctx.clientId, accessMethod, action: name, resource: resourceOf(args), scope: tool.scope, result: "success" });
    return out;
  } catch (e) {
    const err = e as AgentAuthError;
    await audit({ authorizationId: ctx.authorization.id, userId: ctx.userId, clientId: ctx.clientId, accessMethod, action: name, resource: resourceOf(args), scope: tool.scope, result: err.status === 403 ? "denied" : err.status === 404 ? "denied" : "error", detail: { code: err.code ?? "error", message: err.message } });
    throw e;
  }
}
function resourceOf(args: Record<string, unknown> | undefined): string | null {
  if (!args) return null;
  for (const k of ["lead_id", "research_id", "business_id", "member_id"]) if (typeof args[k] === "string") return `${k}:${args[k]}`;
  return typeof args.query === "string" && args.query ? `query:${args.query.slice(0, 60)}` : null;
}
