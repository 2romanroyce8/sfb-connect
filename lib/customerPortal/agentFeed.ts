// Step 11 / dashboard — the agent's actions as a feed, each with a
// human-approved badge where a human approved it and the credit receipt where
// credits moved. Built only from rows that exist (outbound_events joined to
// credit_transactions); an empty business gets an honest empty state.
import type { SupabaseClient } from "@supabase/supabase-js";

export type FeedItem = { id: string; at: string; title: string; detail: string | null; kind: string; approved: boolean; credits: number | null; status: "done" | "waiting" | "failed" };

const TITLES: Record<string, (p: string) => string> = {
  sourced: (p) => `Found ${p}`,
  enriched: (p) => `Read ${p}'s website`,
  approval_requested: (p) => `Drafted an intro to ${p} — waiting for your approval`,
  approved: (p) => `You approved the message to ${p}`,
  rejected: (p) => `You rejected the draft to ${p}`,
  sent: (p) => `Sent to ${p}`,
  failed: (p) => `Send to ${p} failed`,
  replied: (p) => `${p} replied`,
  booked: (p) => `Booked a call with ${p}`,
  unsubscribed: (p) => `${p} unsubscribed`,
};

export async function getAgentFeed(service: SupabaseClient, businessId: string, limit = 30): Promise<FeedItem[]> {
  const { data: events } = await service.from("outbound_events").select("id, kind, actor, payload, created_at, prospect_id, message_id").eq("business_id", businessId).order("created_at", { ascending: false }).limit(limit);
  if (!events?.length) return [];
  const pids = Array.from(new Set(events.map((e) => e.prospect_id as string).filter(Boolean)));
  const txIds = events.map((e) => (e.payload as { credit_tx?: string } | null)?.credit_tx).filter((x): x is string => !!x);
  const [{ data: prospects }, { data: txs }] = await Promise.all([
    pids.length ? service.from("outbound_prospects").select("id, name").in("id", pids) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    txIds.length ? service.from("credit_transactions").select("id, amount").in("id", txIds) : Promise.resolve({ data: [] as { id: string; amount: number }[] }),
  ]);
  const name = new Map((prospects ?? []).map((p) => [p.id, p.name])); const amt = new Map((txs ?? []).map((t) => [t.id, t.amount]));
  // A draft that was later approved or rejected is no longer "Needs you".
  const resolved = new Set(events.filter((e) => e.kind === "approved" || e.kind === "rejected").map((e) => (e as { message_id?: string | null }).message_id ?? (e.payload as { message_id?: string } | null)?.message_id).filter(Boolean) as string[]);
  const friendlyFail = (err: unknown) => { const t = typeof err === "string" ? err : ""; if (/not connected/i.test(t)) return "Connect Gmail and this sends."; if (/Gmail refused|invalid_grant|unauthorized/i.test(t)) return "Gmail refused the send — reconnect Gmail in Integrations."; return "Couldn't send — your Gmail connection needs attention; we'll retry once it's fixed."; };
  return events.map((e) => {
    const p = name.get(e.prospect_id as string) ?? "a prospect"; const kind = e.kind as string; const payload = (e.payload as Record<string, unknown> | null) ?? {};
    const tx = payload.credit_tx as string | undefined; const credits = tx && amt.has(tx) ? Math.abs(amt.get(tx)!) : null;
    const actor = (e.actor as { kind?: string } | null)?.kind;
    return {
      id: e.id as string, at: e.created_at as string, kind,
      title: kind === "sourced" && payload.from === "upload" ? `Added ${p} from your uploaded list` : (TITLES[kind] ?? ((x: string) => `${kind.replace(/_/g, " ")} — ${x}`))(p),
      detail: kind === "enriched" ? (payload.found ? `Found a contact${payload.email ? ` (${payload.email})` : ""}` : "Nothing public found — 0 credits") : kind === "failed" ? friendlyFail(payload.error) : kind === "approval_requested" ? "Nothing sends until you approve it." : null,
      approved: kind === "approved" || kind === "sent" || (kind === "booked" && actor === "user"),
      credits, status: kind === "failed" ? "failed" : kind === "approval_requested" && !resolved.has((e as { message_id?: string | null }).message_id ?? "") ? "waiting" : "done",
    };
  });
}
