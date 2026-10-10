import { sendEmail, creditWarningEmail, creditsExhaustedEmail } from "@/lib/email/resend";
import { emitIntegrationEvent } from "@/lib/integrations/events";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCreditBalance } from "./credits";
import { creditPrice, WARN_AT, CRITICAL_AT } from "@/lib/agentProgram/config";

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

/**
 * Charges a completed or failed action through the atomic `spend_credits`
 * Postgres function: idempotent (a retried key returns the original row and
 * writes nothing), serialized per business (advisory lock), and the ledger
 * can never go negative. Failed work writes a 0-credit receipt row.
 * Unknown action key → rejected (throws), nothing written.
 */
export async function chargeAction(service: SupabaseClient, input: { businessId: string; actionKey: string; outcome: "completed" | "failed"; description?: string; idempotencyKey: string; actorId?: string | null; resultRef?: string | null; approvedBy?: string | null }) {
  const price = creditPrice(input.actionKey);
  if (!price) throw new Error(`Unknown action ${input.actionKey}`);
  const cost = input.outcome === "failed" ? 0 : price.credits;
  const description = input.description ?? `${price.label}${input.outcome === "failed" ? " — didn't go through (0 credits)" : ""}`;
  const { data, error } = await service.rpc("spend_credits", {
    p_business_id: input.businessId, p_capability: price.capability, p_action_key: price.key, p_cost: cost, p_idempotency_key: input.idempotencyKey,
    p_description: description, p_result_ref: input.resultRef ?? null, p_approved_by: input.approvedBy ?? null, p_actor_id: input.actorId ?? null,
  });
  if (error) {
    if (/INSUFFICIENT/.test(error.message)) {
      const balance = await getCreditBalance(service, input.businessId);
      await service.from("businesses").update({ work_paused_reason: "out_of_credits", updated_at: new Date().toISOString() }).eq("id", input.businessId);
      void notifyCreditThresholds(service, input.businessId, balance);
      throw new InsufficientCreditsError(balance, cost);
    }
    throw new Error(`Could not charge credits: ${error.message}`);
  }
  const row = data as { id: string; amount: number; balance_after: number; idempotency_key: string };
  emitIntegrationEvent("credits.charged", { business_id: input.businessId, action_key: input.actionKey, credits: cost, outcome: input.outcome, balance_after: row.balance_after });
  void notifyCreditThresholds(service, input.businessId, row.balance_after);
  return row;
}

export type CreditBreakdown = { balance: number; allotment: number; monthlySpent: number; monthlyRemaining: number; topupBalance: number; cycleStartedAt: string | null };
/** "132 / 150 + 40 top-up" — derived from the ledger by get_credit_breakdown (monthly allotment spends first). */
export async function getCreditBreakdown(client: SupabaseClient, businessId: string): Promise<CreditBreakdown> {
  const { data, error } = await client.rpc("get_credit_breakdown", { p_business_id: businessId });
  if (error) throw new Error(`Could not read credit breakdown: ${error.message}`);
  const r = (Array.isArray(data) ? data[0] : data) as { balance: number; allotment: number; monthly_spent: number; monthly_remaining: number; topup_balance: number; cycle_started_at: string | null } | undefined;
  return { balance: r?.balance ?? 0, allotment: r?.allotment ?? 0, monthlySpent: r?.monthly_spent ?? 0, monthlyRemaining: r?.monthly_remaining ?? 0, topupBalance: r?.topup_balance ?? 0, cycleStartedAt: r?.cycle_started_at ?? null };
}

/** Pure version of the split for tests and client-side display. */
export function splitBalance(balance: number, allotment: number, spentThisCycle: number): { monthlySpent: number; monthlyRemaining: number; topupBalance: number } {
  const monthlySpent = Math.min(Math.max(0, spentThisCycle), Math.max(0, allotment));
  const monthlyRemaining = Math.max(0, Math.min(allotment - monthlySpent, balance));
  return { monthlySpent, monthlyRemaining, topupBalance: Math.max(0, balance - monthlyRemaining) };
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
    const { data: b } = await service.from("businesses").select("legal_name, owner_id, monthly_credit_allotment, credits_cycle_started_at, credit_alerts_sent, agent_overseer_id").eq("id", businessId).single();
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
    // At zero the human overseer is told too — work stopped on an account they sign for.
    if (want === "exhausted" && b.agent_overseer_id) {
      const { data: ov } = await service.from("users").select("email").eq("id", b.agent_overseer_id).maybeSingle();
      if (ov?.email) void sendEmail({ to: ov.email as string, subject: `Agent paused — ${b.legal_name} is out of credits`, html: `<p><strong>${b.legal_name}</strong> reached zero credits; the agent paused and the owner was notified. Reporting still works. Nothing to approve until they top up or refill.</p>`, text: `${b.legal_name} reached zero credits; agent paused, owner notified.` });
    }
    if (r.sent) await service.from("businesses").update({ credit_alerts_sent: { ...sent, [want]: cycle } }).eq("id", businessId);
  } catch (e) {
    console.error("[credits] threshold notice failed:", e instanceof Error ? e.message : e);
  }
}