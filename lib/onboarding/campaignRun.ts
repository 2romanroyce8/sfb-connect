// Step 10 — first campaign, server side. Drives the outbound engine for the
// customer: enrich → draft (lands in the approval queue) → the customer
// approves per item or all → send (free) when Gmail is connected. Credit
// guards come from the engine (workAllowed / spend_credits); this layer turns
// a paused balance into a friendly top-up prompt instead of a dead end.
import type { SupabaseClient } from "@supabase/supabase-js";
import { enrichProspect, startSequence, approveMessage, rejectMessage, OutboundError } from "@/lib/outbound/engine";
import { InsufficientCreditsError } from "@/lib/billing/guards";
import { getCreditBalance } from "@/lib/billing/credits";
import { planLaunch, summarizeLaunch, PRICES, type LaunchResult } from "./campaign";

export type CampaignStatus = {
  balance: number; prices: typeof PRICES; gmailConnected: boolean;
  prospects: { total: number; sourced: number; inSequence: number; noEmail: number };
  queue: { id: string; prospect: string; to: string | null; subject: string | null; body: string | null; status: string; approvedAt: string | null; sentAt: string | null; error: string | null; createdAt: string }[];
  counts: { pending: number; approved: number; sent: number; failed: number; rejected: number };
  plan: ReturnType<typeof planLaunch>;
};

export async function campaignStatus(service: SupabaseClient, business: { id: string; owner_id: string }): Promise<CampaignStatus> {
  const [balance, { data: prospects }, { data: msgs }, { data: gmail }] = await Promise.all([
    getCreditBalance(service, business.id),
    service.from("outbound_prospects").select("id, name, status, email, website").eq("business_id", business.id),
    service.from("outbound_messages").select("id, prospect_id, to_email, subject, body_text, status, approved_at, sent_at, error, created_at").eq("business_id", business.id).eq("direction", "out").order("created_at", { ascending: false }).limit(60),
    service.from("integration_connections").select("id").eq("provider", "gmail").eq("owner_id", business.owner_id).eq("status", "active").limit(1).maybeSingle(),
  ]);
  const ps = prospects ?? []; const names = new Map(ps.map((p) => [p.id as string, p.name as string]));
  const sourced = ps.filter((p) => p.status === "sourced" || p.status === "enriched").length;
  const queue = (msgs ?? []).map((m) => ({ id: m.id as string, prospect: names.get(m.prospect_id as string) ?? "—", to: m.to_email as string | null, subject: m.subject as string | null, body: m.body_text as string | null, status: m.status as string, approvedAt: m.approved_at as string | null, sentAt: m.sent_at as string | null, error: m.error as string | null, createdAt: m.created_at as string }));
  const c = (s: string) => queue.filter((q) => q.status === s).length;
  return {
    balance, prices: PRICES, gmailConnected: !!gmail,
    prospects: { total: ps.length, sourced, inSequence: ps.filter((p) => p.status === "in_sequence").length, noEmail: ps.filter((p) => p.status === "enriched" && !p.email).length },
    queue, counts: { pending: c("pending_approval"), approved: c("approved"), sent: c("sent"), failed: c("failed"), rejected: c("rejected") },
    plan: planLaunch(sourced, balance, undefined, ps.filter((p) => (p.status === "sourced" || p.status === "enriched") && !!p.email).length),
  };
}

/** Launch: enrich + draft the first batch. Stops cleanly when credits run out; nothing is ever sent here. */
export async function launchCampaign(service: SupabaseClient, business: { id: string; owner_id: string }, actor: { id: string; label: string }) {
  const balance = await getCreditBalance(service, business.id);
  const { data: candidates } = await service.from("outbound_prospects").select("id, name, email, website, status").eq("business_id", business.id).in("status", ["sourced", "enriched"]).order("created_at", { ascending: true }).limit(40);
  // Prospects that already have an email (uploaded lists) go first: no site read, half the cost, ready now.
  const ordered = [...(candidates ?? [])].sort((x, y) => Number(!!y.email) - Number(!!x.email));
  const plan = planLaunch(ordered.length, balance, undefined, ordered.filter((p) => !!p.email).length);
  if (plan.count === 0) return { plan, results: [] as LaunchResult[], summary: summarizeLaunch([]) };
  const results: LaunchResult[] = [];
  const a = { kind: "user" as const, id: actor.id, label: actor.label };
  for (const p of ordered.slice(0, plan.count)) {
    try {
      let email = p.email as string | null;
      if (!email) {
        if (!p.website) { results.push({ prospectId: p.id, name: p.name, outcome: "no_website" }); continue; }
        const r = await enrichProspect(service, p.id, a); email = (r.prospect?.email as string | null) ?? null;
        if (!email) { results.push({ prospectId: p.id, name: p.name, outcome: "no_email" }); continue; }
      }
      await startSequence(service, p.id, a);
      results.push({ prospectId: p.id, name: p.name, outcome: "drafted" });
    } catch (e) {
      if (e instanceof InsufficientCreditsError || (e instanceof OutboundError && e.code.startsWith("work_paused"))) { results.push({ prospectId: p.id, name: p.name, outcome: "paused", detail: e.message }); break; }
      if (e instanceof OutboundError && (e.code === "no_website" || e.code === "missing_facts")) { results.push({ prospectId: p.id, name: p.name, outcome: e.code === "no_website" ? "no_website" : "error", detail: e.message }); continue; }
      results.push({ prospectId: p.id, name: p.name, outcome: "error", detail: e instanceof Error ? e.message : "failed" });
    }
  }
  return { plan, results, summary: summarizeLaunch(results) };
}

/** The approval moment. Approve = human review pass (charged) → send when Gmail is connected (free); otherwise it waits as approved. */
export async function approveCampaign(service: SupabaseClient, business: { id: string; owner_id: string }, approver: { id: string; label: string }, ids: string[] | "all") {
  const { data: gmail } = await service.from("integration_connections").select("id").eq("provider", "gmail").eq("owner_id", business.owner_id).eq("status", "active").limit(1).maybeSingle();
  let q = service.from("outbound_messages").select("id").eq("business_id", business.id).eq("status", "pending_approval");
  if (ids !== "all") q = q.in("id", ids);
  const { data: targets } = await q;
  const out: { id: string; result: "approved" | "sent" | "failed" | "paused" | "error"; detail?: string }[] = [];
  for (const t of targets ?? []) {
    try {
      const m = await approveMessage(service, t.id as string, approver, { andSend: !!gmail });
      out.push({ id: t.id as string, result: m?.status === "sent" ? "sent" : m?.status === "failed" ? "failed" : "approved", detail: (m as { error?: string | null })?.error ?? undefined });
    } catch (e) {
      if (e instanceof InsufficientCreditsError || (e instanceof OutboundError && e.code.startsWith("work_paused"))) { out.push({ id: t.id as string, result: "paused", detail: e.message }); break; }
      out.push({ id: t.id as string, result: "error", detail: e instanceof Error ? e.message : "failed" });
    }
  }
  return { results: out, gmailConnected: !!gmail };
}

export async function rejectCampaignMessage(service: SupabaseClient, id: string, approver: { id: string; label: string }, reason: string) {
  return rejectMessage(service, id, approver, reason || "Not this one");
}
