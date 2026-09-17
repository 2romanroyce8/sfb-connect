// SFB Action Credits ledger. The ledger (credit_transactions) is the audit
// truth -- balance is always DERIVED from it, never stored as an
// independently-mutable counter. Reserve-then-consume is the pattern for
// every action that costs credits: reserving does NOT touch the ledger (so
// nothing is "spent" yet), and only a genuinely COMPLETED action writes a
// USAGE row. A FAILED action just marks its reservation failed and writes
// nothing -- credits were never actually deducted, so there's nothing to
// refund.
import type { SupabaseClient } from "@supabase/supabase-js";

export type CreditTransactionType = "PURCHASE" | "USAGE" | "REFUND" | "ADJUSTMENT" | "PROMOTIONAL" | "REVERSAL" | "EXPIRATION";

/** The real, settled balance -- sum of every ledger row. */
export async function getCreditBalance(supabase: SupabaseClient, businessId: string): Promise<number> {
  const { data, error } = await supabase.rpc("get_credit_balance", { p_business_id: businessId });
  if (error) throw new Error(`Could not read credit balance: ${error.message}`);
  return data ?? 0;
}

/** Settled balance minus anything currently RESERVED/EXECUTING -- this is
 * what a purchase/reservation flow should check against, so two
 * back-to-back reservations can't both succeed against the same credits
 * before either completes (the actual "prevent double spending" guard). */
export async function getAvailableBalance(supabase: SupabaseClient, businessId: string): Promise<number> {
  const [balance, { data: reservations, error }] = await Promise.all([
    getCreditBalance(supabase, businessId),
    supabase.from("action_credit_reservations").select("credits").eq("business_id", businessId).in("status", ["RESERVED", "EXECUTING"]),
  ]);
  if (error) throw new Error(`Could not read active reservations: ${error.message}`);
  const reserved = (reservations ?? []).reduce((sum, r) => sum + r.credits, 0);
  return balance - reserved;
}

/** Appends an immutable ledger row and returns the resulting balance.
 * idempotencyKey, when provided, makes this safe against webhook retries
 * (a Postgres unique constraint on credit_transactions.idempotency_key
 * rejects a duplicate insert outright). */
export async function appendCreditTransaction(
  supabase: SupabaseClient,
  params: {
    businessId: string;
    type: CreditTransactionType;
    amount: number; // positive = credit in, negative = credit out
    source?: string;
    purchaseId?: string;
    reservationId?: string;
    description?: string;
    idempotencyKey?: string;
    actorId?: string;
  }
): Promise<{ balanceAfter: number; deduped: boolean }> {
  const currentBalance = await getCreditBalance(supabase, params.businessId);
  const balanceAfter = currentBalance + params.amount;
  const { error } = await supabase.from("credit_transactions").insert({
    business_id: params.businessId,
    type: params.type,
    amount: params.amount,
    balance_after: balanceAfter,
    source: params.source ?? null,
    purchase_id: params.purchaseId ?? null,
    reservation_id: params.reservationId ?? null,
    description: params.description ?? null,
    idempotency_key: params.idempotencyKey ?? null,
    actor_id: params.actorId ?? null,
  });
  if (error) {
    // Postgres unique_violation on idempotency_key -- this exact event was
    // already processed (a webhook retry). Not an error: the correct,
    // idempotent response is "already applied, here's the current balance".
    if (error.code === "23505" && params.idempotencyKey) {
      return { balanceAfter: currentBalance, deduped: true };
    }
    throw new Error(`Could not record credit transaction: ${error.message}`);
  }
  return { balanceAfter, deduped: false };
}

export class InsufficientCreditsError extends Error {
  constructor(available: number, needed: number) {
    super(`Not enough Action Credits: ${available} available, ${needed} needed.`);
    this.name = "InsufficientCreditsError";
  }
}

/** Reserves credits for an action WITHOUT touching the ledger. Throws
 * InsufficientCreditsError (never silently proceeds) if the available
 * balance can't cover it. */
export async function reserveCredits(
  supabase: SupabaseClient,
  params: { businessId: string; actionCatalogId: string; credits: number; relatedEntityType?: string; relatedEntityId?: string }
): Promise<{ reservationId: string }> {
  const available = await getAvailableBalance(supabase, params.businessId);
  if (available < params.credits) throw new InsufficientCreditsError(available, params.credits);

  const { data, error } = await supabase
    .from("action_credit_reservations")
    .insert({
      business_id: params.businessId,
      action_catalog_id: params.actionCatalogId,
      credits: params.credits,
      status: "RESERVED",
      related_entity_type: params.relatedEntityType ?? null,
      related_entity_id: params.relatedEntityId ?? null,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Could not reserve credits: ${error?.message ?? "unknown error"}`);
  return { reservationId: data.id };
}

/** The action genuinely completed and delivered value -- NOW the credits
 * are actually consumed via a real ledger USAGE row. */
export async function completeReservation(supabase: SupabaseClient, reservationId: string, description?: string): Promise<void> {
  const { data: reservation, error: readError } = await supabase
    .from("action_credit_reservations")
    .select("id, business_id, credits, status")
    .eq("id", reservationId)
    .single();
  if (readError || !reservation) throw new Error("Reservation not found.");
  if (reservation.status === "COMPLETED") return; // already completed -- idempotent no-op
  if (reservation.status !== "RESERVED" && reservation.status !== "EXECUTING") {
    throw new Error(`Cannot complete a reservation in status ${reservation.status}.`);
  }

  await appendCreditTransaction(supabase, {
    businessId: reservation.business_id,
    type: "USAGE",
    amount: -reservation.credits,
    source: "action_reservation",
    reservationId: reservation.id,
    description,
  });
  await supabase.from("action_credit_reservations").update({ status: "COMPLETED", resolved_at: new Date().toISOString() }).eq("id", reservationId);
}

/** The action could not legitimately execute -- release the reservation.
 * Nothing was ever deducted from the ledger, so there is nothing to
 * refund; this just frees up the reserved capacity. */
export async function failReservation(supabase: SupabaseClient, reservationId: string): Promise<void> {
  const { data: reservation } = await supabase.from("action_credit_reservations").select("status").eq("id", reservationId).single();
  if (reservation?.status === "COMPLETED") return; // never fail something already completed
  await supabase.from("action_credit_reservations").update({ status: "FAILED", resolved_at: new Date().toISOString() }).eq("id", reservationId);
}
