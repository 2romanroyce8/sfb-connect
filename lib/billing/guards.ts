import { sendEmail, creditWarningEmail, creditsExhaustedEmail } from "@/lib/email/resend";
import { emitIntegrationEvent } from "@/lib/integrations/events";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCreditBalance } from "./credits";
import { alertOwners } from "@/lib/notify/ownerAlerts";
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

/**
 * Free for the team (Rome, 2026-10-19): SFB Connect's own business
 * (businesses.is_house_account) and any business owned by an owner or
 * employee (users.team_role set) never spend credits and are never paused for
 * credits. Charges still write a 0-credit receipt so the ledger and
 * idempotency keys stay intact. Clients are billed exactly as before.
 */
export async function isTeamFree(service: SupabaseClient, businessId: string): Promise<boolean> {
  const { data: b } = await service.from("businesses").select("owner_id, is_house_account").eq("id", businessId).maybeSingle();
  if (!b) return false;
  if ((b as { is_house_account?: boolean }).is_house_account) return true;
  if (!b.owner_id) return false;
  const { data: u } = await service.from("users").select("team_role").eq("id", b.owner_id).maybeSingle();
  return !!u?.team_role;
}
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
  const free = await isTeamFree(service, input.businessId);
  const cost = input.outcome === "failed" || free ? 0 : price.credits;
  const description = (input.description ?? `${price.label}${input.outcome === "failed" ? " — didn't go through (0 credits)" : ""}`) + (free && input.outcome !== "failed" ? " — free (SFB Connect team)" : "");
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
  if (!free) void notifyCreditThresholds(service, input.businessId, row.balance_after);
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
  const [{ data: b }, balance, free] = await Promise.all([
    service.from("businesses").select("plan_key").eq("id", businessId).single(),
    getCreditBalance(service, businessId),
    isTeamFree(service, businessId),
  ]);
  if (free) return { allowed: true, reason: null, balance };
  if (!b?.plan_key) return { allowed: false, reason: "no_plan", balance };
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
    // Team owners: a customer account is low / stopped — text + in-app (email as fallback / until SMS verified).
    const name = b.legal_name as string;
    await alertOwners(service, want === "exhausted" ? {
      trigger: "credits_exhausted",
      sms: `Credits at zero: ${name}. Agent paused. Owner emailed.`,
      email: { subject: `Credits at zero — ${name}`, html: `<p><strong>${name}</strong> reached zero credits; the agent paused and the owner was emailed.</p>`, text: `${name} reached zero credits; the agent paused and the owner was emailed.` },
      inApp: { type: "credits_warning", title: `Credits at zero: ${name}`, body: "Agent paused. The customer was emailed.", actionUrl: `/team/dashboard`, actionLabel: "Open" },
      detail: { business_id: businessId, balance: balanceAfter },
    } : {
      trigger: "credits_warning",
      sms: `Credits ${state.usedPct}% used: ${name} has ${balanceAfter} of ${allotment} left this cycle.`,
      email: { subject: `Credits at ${state.usedPct}% — ${name}`, html: `<p><strong>${name}</strong> has used ${state.usedPct}% of this cycle's credits (${balanceAfter} of ${allotment} left). The owner was emailed.</p>`, text: `${name} has used ${state.usedPct}% of this cycle's credits (${balanceAfter} of ${allotment} left).` },
      inApp: { type: "credits_warning", title: `Credits at ${state.usedPct}%: ${name}`, body: `${balanceAfter} of ${allotment} left this cycle. The customer was emailed.`, actionUrl: `/team/dashboard`, actionLabel: "Open" },
      detail: { business_id: businessId, balance: balanceAfter },
    });
  } catch (e) {
    console.error("[credits] threshold notice failed:", e instanceof Error ? e.message : e);
  }
}