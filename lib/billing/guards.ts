import type { SupabaseClient } from "@supabase/supabase-js";
import { appendCreditTransaction, getCreditBalance } from "./credits";
import { creditPrice, WARN_AT, CRITICAL_AT, type CapabilityKey } from "@/lib/agentProgram/config";

// ============================================================
// CREDIT GUARDS -- one credit type, metered against the monthly allotment
// plus top-ups. Rules (published on the pricing page):
//  * the ledger can never go negative;
//  * failed work costs 0 (a 0-credit row so the feed shows it);
//  * completed work costs credits even if disliked;
//  * at 80% used: warning; at 0: work pauses, reports still work.
// ============================================================

export type CreditLevel = "ok" | "warn" | "critical" | "empty";
export function creditState(balance: number, allotment: number): { level: CreditLevel; usedPct: number } {
  if (balance <= 0) return { level: "empty", usedPct: 100 };
  if (allotment <= 0) return { level: "ok", usedPct: 0 };
  const used = Math.max(0, Math.min(1, 1 - balance / allotment));
  return { level: used >= CRITICAL_AT ? "critical" : used >= WARN_AT ? "warn" : "ok", usedPct: Math.round(used * 100) };
}

export class InsufficientCreditsError extends Error { constructor(public balance: number, public cost: number) { super(`Insufficient credits: ${cost} needed, ${balance} available. Work is paused until credits are added.`); } }

/** Charges a completed or failed action. Returns the ledger row (amount 0 for failed). */
export async function chargeAction(service: SupabaseClient, input: { businessId: string; actionKey: string; outcome: "completed" | "failed"; description?: string; idempotencyKey: string; actorId?: string | null }) {
  const price = creditPrice(input.actionKey);
  if (!price) throw new Error(`Unknown action ${input.actionKey}`);
  const cost = input.outcome === "failed" ? 0 : price.credits;
  if (cost > 0) {
    const balance = await getCreditBalance(service, input.businessId);
    if (balance < cost) {
      await service.from("businesses").update({ work_paused_reason: "out_of_credits", updated_at: new Date().toISOString() }).eq("id", input.businessId);
      throw new InsufficientCreditsError(balance, cost);
    }
  }
  const row = await appendCreditTransaction(service, { businessId: input.businessId, type: "USAGE", amount: -cost, source: "agent_action", description: input.description ?? `${price.label}${input.outcome === "failed" ? " — failed (0 credits)" : ""}`, idempotencyKey: input.idempotencyKey, actorId: input.actorId ?? null } as Parameters<typeof appendCreditTransaction>[1]);
  await service.from("credit_transactions").update({ capability_key: price.capability === "human" ? null : (price.capability as CapabilityKey), action_key: price.key }).eq("idempotency_key", input.idempotencyKey);
  return row;
}

/** Whether the agent may do paid work for this business right now. */
export async function workAllowed(service: SupabaseClient, businessId: string): Promise<{ allowed: boolean; reason: string | null; balance: number }> {
  const [{ data: b }, balance] = await Promise.all([
    service.from("businesses").select("plan_key, is_sandbox, trial_expires_at").eq("id", businessId).single(),
    getCreditBalance(service, businessId),
  ]);
  if (!b?.plan_key) return { allowed: false, reason: "no_plan", balance };
  if (b.plan_key === "trial" && b.trial_expires_at && new Date(b.trial_expires_at) < new Date()) return { allowed: false, reason: "trial_expired", balance };
  if (balance <= 0) return { allowed: false, reason: "out_of_credits", balance };
  return { allowed: true, reason: null, balance };
}
