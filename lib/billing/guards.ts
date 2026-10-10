import { sendEmail, creditWarningEmail, creditsExhaustedEmail } from "@/lib/email/resend";
import { emitIntegrationEvent } from "@/lib/integrations/events";
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
  emitIntegrationEvent("credits.charged", { business_id: input.businessId, action_key: input.actionKey, credits: cost, outcome: input.outcome, balance_after: (row as { balance_after?: number }).balance_after ?? null });
  void notifyCreditThresholds(service, input.businessId, (row as { balance_after?: number }).balance_after ?? null);
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

/**
 * 80% warning and zero-balance notice to the business owner, each at most once
 * per credit cycle (businesses.credit_alerts_sent tracks what went out).
 * Best-effort: never throws into the charge path.
 */
async function notifyCreditThresholds(service: SupabaseClient, businessId: string, balanceAfter: number | null) {
  try {
    if (balanceAfter == null) return;
    const { data: b } = await service.from("businesses").select("legal_name, owner_id, monthly_credit_allotment, credits_cycle_started_at, credit_alerts_sent").eq("id", businessId).single();
    if (!b) return;
    const allotment = (b.monthly_credit_allotment as number) || 0;
    const state = creditState(balanceAfter, allotment);
    const sent = ((b.credit_alerts_sent as Record<string, string> | null) ?? {});
    const cycle = (b.credits_cycle_started_at as string | null) ?? "none";
    const want = balanceAfter <= 0 ? "exhausted" : state.level !== "ok" ? "warn" : null;
    if (!want || sent[want] === cycle) return;
    const { data: owner } = await service.from("users").select("email").eq("id", b.owner_id).maybeSingle();
    if (!owner?.email) return;
    const msg = want === "exhausted" ? creditsExhaustedEmail({ businessName: b.legal_name }) : creditWarningEmail({ businessName: b.legal_name, balance: balanceAfter, allotment, usedPct: state.usedPct });
    const r = await sendEmail({ to: owner.email as string, ...msg });
    if (r.sent) await service.from("businesses").update({ credit_alerts_sent: { ...sent, [want]: cycle } }).eq("id", businessId);
  } catch (e) {
    console.error("[credits] threshold notice failed:", e instanceof Error ? e.message : e);
  }
}