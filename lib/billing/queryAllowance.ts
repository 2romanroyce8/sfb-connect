import type { SupabaseClient } from "@supabase/supabase-js";
import { getEntitlements } from "./entitlements";

/**
 * AI QUERY BILLING UNIT (owner decision, 2026-09-21):
 *
 *   1 TRACKED QUERY = 1 customer-intent question x 1 monitored business location
 *
 * Running that tracked query across ChatGPT + Claude + Perplexity + Grok +
 * Gemini still consumes exactly ONE unit of the customer's allowance.
 * Provider executions are an INTERNAL cost/operational unit ("provider
 * checks", counted on ai_check_jobs / projects.checks_*), never surfaced as
 * the customer's allowance.
 *
 * What counts: ACTIVE tracked_queries rows. Rescanning an existing tracked
 * query never charges allowance again. Archiving a query frees its unit
 * (its historical observations are retained -- nothing is deleted).
 *
 * The allowance itself comes from getEntitlements().queryAllowance, which
 * is BASE_ALLOWANCES[plan].queries + active ai_visibility_expansion add-on
 * quantity x 25 -- read from the live catalog/add-on state, never
 * hardcoded here.
 *
 * This is the ONE server-authoritative gate. UI never re-implements it.
 */

export type TrackedQueryUsage = { active: number; allowance: number; remaining: number; atLimit: boolean };

export async function getTrackedQueryUsage(supabase: SupabaseClient, businessId: string): Promise<TrackedQueryUsage> {
  const [entitlements, { count }] = await Promise.all([
    getEntitlements(supabase, businessId),
    supabase.from("tracked_queries").select("id", { count: "exact", head: true }).eq("business_id", businessId).eq("status", "active"),
  ]);
  const active = count ?? 0;
  const allowance = entitlements.queryAllowance;
  return { active, allowance, remaining: Math.max(0, allowance - active), atLimit: active >= allowance };
}

export async function getTrackedQueryAllowance(supabase: SupabaseClient, businessId: string): Promise<number> {
  return (await getEntitlements(supabase, businessId)).queryAllowance;
}

/** How many NEW active tracked queries may be created right now. Callers
 * creating a batch must slice to this number -- never create over. */
export async function canCreateTrackedQueries(supabase: SupabaseClient, businessId: string, requested: number): Promise<{ allowed: number; usage: TrackedQueryUsage }> {
  const usage = await getTrackedQueryUsage(supabase, businessId);
  return { allowed: Math.max(0, Math.min(requested, usage.remaining)), usage };
}

export class QueryAllowanceExceededError extends Error {
  constructor(public usage: TrackedQueryUsage) {
    super(`Tracked query allowance reached (${usage.active}/${usage.allowance}).`);
    this.name = "QueryAllowanceExceededError";
  }
}
