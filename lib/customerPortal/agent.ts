import type { SupabaseClient } from "@supabase/supabase-js";
import { CAPABILITIES, CAPABILITY_KEYS, tier, stockProfile } from "@/lib/agentProgram/config";
import { creditState } from "@/lib/billing/guards";
import { getCreditBalance } from "@/lib/billing/credits";

export type LedgerRow = { id: string; type: string; amount: number; balance_after: number; description: string | null; capability_key: string | null; action_key: string | null; created_at: string };

/** Everything the customer agent surfaces need, read under the customer's own RLS. */
export async function loadAgentState(supabase: SupabaseClient, businessId: string) {
  const [{ data: biz }, { data: caps }, { data: ledger }, balance] = await Promise.all([
    supabase.from("businesses").select("plan_key, is_sandbox, stock_profile_key, trial_expires_at, monthly_credit_allotment, credits_cycle_started_at, work_paused_reason, agent_overseer_id").eq("id", businessId).single(),
    supabase.from("business_capabilities").select("capability_key, enabled").eq("business_id", businessId),
    supabase.from("credit_transactions").select("id, type, amount, balance_after, description, capability_key, action_key, created_at").eq("business_id", businessId).order("created_at", { ascending: false }).limit(200),
    getCreditBalance(supabase, businessId),
  ]);
  const enabled = new Map((caps ?? []).map((c) => [c.capability_key, c.enabled]));
  const cycleStart = biz?.credits_cycle_started_at ? new Date(biz.credits_cycle_started_at) : null;
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const since = cycleStart ?? monthStart;
  const spendByCap: Record<string, number> = Object.fromEntries(CAPABILITY_KEYS.map((k) => [k, 0]));
  for (const r of (ledger ?? []) as LedgerRow[]) if (r.type === "USAGE" && r.capability_key && new Date(r.created_at) >= since) spendByCap[r.capability_key] = (spendByCap[r.capability_key] ?? 0) + Math.abs(r.amount);
  const t = tier(biz?.plan_key);
  const allotment = biz?.monthly_credit_allotment ?? t?.credits ?? 0;
  const state = creditState(balance, allotment);
  const trialExpired = !!biz?.trial_expires_at && new Date(biz.trial_expires_at) < new Date();
  const agentStatus: "green" | "yellow" | "red" = balance <= 0 || trialExpired || biz?.work_paused_reason ? "red" : state.level === "ok" ? "green" : "yellow";
  return {
    tier: t, isSandbox: !!biz?.is_sandbox, stock: stockProfile(biz?.stock_profile_key), trialExpiresAt: biz?.trial_expires_at ?? null, trialExpired,
    balance, allotment, creditLevel: state.level, usedPct: state.usedPct, agentStatus, workPausedReason: biz?.work_paused_reason ?? null,
    nextRefill: cycleStart && t && t.monthlyUsd > 0 ? new Date(cycleStart.getTime() + 30 * 86400000).toISOString() : null,
    capabilities: CAPABILITIES.map((c) => ({ ...c, enabled: enabled.get(c.key) ?? false, spend: spendByCap[c.key] ?? 0 })),
    ledger: (ledger ?? []) as LedgerRow[],
    priceListVisible: t?.priceListVisible ?? false,
  };
}
