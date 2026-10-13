// Spend accounting for the editing help (Roman, 2026-10-12): every model call
// is logged (business, who, tokens, cost) and a configurable daily cap turns
// the buttons off for the rest of the ET day instead of failing mid-edit.
// Nothing here needs the key to exist; it just reports `configured: false`.
import type { SupabaseClient } from "@supabase/supabase-js";
import { ASSIST_INSTRUCTIONS, ASSIST_MODEL, assistConfigured, assistEditRaw, type AssistKey, type AssistUsage } from "./assist";
import { OutboundError } from "./errors";

type Service = SupabaseClient; // service role; these tables are owner-read only

/** Anthropic list price, USD per million tokens, as published 2026-10-12. Update here (one place) if the price or model changes. */
export const MODEL_PRICE_USD_PER_MTOK: Record<string, { input: number; output: number }> = {
  [ASSIST_MODEL]: { input: 3, output: 15 },
};

export const CAP_TIMEZONE = "America/New_York";

/** Pure: cost in cents (4 dp) for a usage record; unknown model → priced like the default model so nothing is logged as free. */
export function estimateCostCents(usage: AssistUsage): number {
  const p = MODEL_PRICE_USD_PER_MTOK[usage.model] ?? MODEL_PRICE_USD_PER_MTOK[ASSIST_MODEL];
  const usd = (usage.input_tokens / 1e6) * p.input + (usage.output_tokens / 1e6) * p.output;
  return Math.round(usd * 100 * 10000) / 10000;
}

/** Pure: start of the current calendar day in the cap timezone, as an ISO instant. */
export function dayStart(now: Date = new Date(), tz: string = CAP_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  // Seconds elapsed since local midnight, subtracted from `now` → local midnight as an instant (DST-safe: uses the wall clock at `now`).
  const sinceMidnight = get("hour") * 3600 + get("minute") * 60 + get("second");
  return new Date(now.getTime() - sinceMidnight * 1000 - now.getMilliseconds()).toISOString();
}

/** Pure: cap decision. A cap of 0 means "no spend allowed" (feature effectively off); spent >= cap → capped. */
export function capDecision(capCents: number, spentCents: number): { capped: boolean; remainingCents: number } {
  const remaining = Math.max(0, capCents - spentCents);
  return { capped: spentCents >= capCents, remainingCents: Math.round(remaining * 10000) / 10000 };
}

export type AssistStatus = { configured: boolean; capped: boolean; capCents: number; spentTodayCents: number; dayStart: string; instructions: typeof ASSIST_INSTRUCTIONS | [] };

/** What the composer needs: not configured → no buttons at all; configured but capped → buttons rendered disabled with the reason. */
export async function assistStatus(service: Service, now: Date = new Date()): Promise<AssistStatus> {
  const configured = assistConfigured();
  const since = dayStart(now);
  if (!configured) return { configured: false, capped: false, capCents: 0, spentTodayCents: 0, dayStart: since, instructions: [] };
  const [{ data: s }, { data: rows }] = await Promise.all([
    service.from("outbound_assist_settings").select("daily_cap_cents").eq("id", 1).maybeSingle(),
    service.from("outbound_assist_calls").select("cost_cents").gte("created_at", since),
  ]);
  const capCents = Number(s?.daily_cap_cents ?? 0);
  const spent = (rows ?? []).reduce((a, r) => a + Number(r.cost_cents ?? 0), 0);
  const { capped } = capDecision(capCents, spent);
  return { configured: true, capped, capCents, spentTodayCents: Math.round(spent * 10000) / 10000, dayStart: since, instructions: ASSIST_INSTRUCTIONS };
}

type CallRow = { business_id: string | null; user_id: string | null; actor_label: string | null; instruction: string; model: string | null; status: "ok" | "error" | "capped"; input_tokens: number; output_tokens: number; cost_cents: number; error: string | null; latency_ms: number | null };

async function record(service: Service, row: CallRow) {
  const { error } = await service.from("outbound_assist_calls").insert(row);
  if (error) console.error("[assist] spend log insert failed:", error.message); // never let logging break the edit the user already paid for
}

/**
 * Production entry point. Order: configured? → under cap? → call → log (ok or error, with real tokens) → return.
 * Throws OutboundError: assist_off (503) when no key, assist_capped (503) when today's cap is reached, assist_failed (502) otherwise.
 */
export async function assistEditLogged(service: Service, who: { businessId: string; userId: string | null; label: string | null }, draft: { subject: string; body: string }, instruction: AssistKey, fetchImpl: typeof fetch = fetch): Promise<{ subject: string; body: string }> {
  const st = await assistStatus(service);
  if (!st.configured) throw new OutboundError("assist_off", "Editing help isn't switched on for this deployment yet. You can still edit by hand.", 503);
  if (st.capped) {
    await record(service, { business_id: who.businessId, user_id: who.userId, actor_label: who.label, instruction, model: null, status: "capped", input_tokens: 0, output_tokens: 0, cost_cents: 0, error: `daily cap ${st.capCents}c reached (spent ${st.spentTodayCents}c since ${st.dayStart})`, latency_ms: null });
    throw new OutboundError("assist_capped", "Editing help has reached today's spend limit and is paused until tomorrow. You can still edit by hand.", 503);
  }
  const t0 = Date.now();
  const r = await assistEditRaw(draft, instruction, fetchImpl);
  const latency = Date.now() - t0;
  await record(service, { business_id: who.businessId, user_id: who.userId, actor_label: who.label, instruction, model: r.usage.model, status: r.ok ? "ok" : "error", input_tokens: r.usage.input_tokens, output_tokens: r.usage.output_tokens, cost_cents: estimateCostCents(r.usage), error: r.ok ? null : r.error, latency_ms: latency });
  if (!r.ok) throw new OutboundError("assist_failed", r.error, 502);
  return r.edited;
}
