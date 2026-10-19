// Live campaign performance, read from the systems that already exist (no duplicate tracking):
//  - outbound_messages (sends / opens / replies) for the variant's template_key, inside the campaign dates
//  - crm_calls / crm_meetings / revenue_events for CRM leads carrying the campaign's (or variant's) tag
import type { SupabaseClient } from "@supabase/supabase-js";
import { EMPTY_METRICS, type Metrics } from "./loop";

type Window = { from: string; to: string };
export function windowOf(c: { start_date: string | null; end_date: string | null; created_at: string }): Window {
  const from = c.start_date ? `${c.start_date}T04:00:00Z` : c.created_at; // ET midnight
  const to = c.end_date ? new Date(Date.parse(`${c.end_date}T04:00:00Z`) + 864e5).toISOString() : new Date(Date.now() + 864e5).toISOString();
  return { from, to };
}

export async function emailMetrics(db: SupabaseClient, templateKey: string | null, w: Window) {
  if (!templateKey) return { sends: 0, opens: 0, replies: 0 };
  const { data: out } = await db.from("outbound_messages").select("id, prospect_id, opened_at, sent_at").eq("template_key", templateKey).eq("direction", "out").eq("status", "sent").gte("sent_at", w.from).lt("sent_at", w.to).limit(5000);
  const sent = out ?? []; const prospects = Array.from(new Set(sent.map((m) => m.prospect_id as string).filter(Boolean)));
  let replies = 0;
  if (prospects.length) { const { data: inn } = await db.from("outbound_messages").select("prospect_id").eq("direction", "in").in("prospect_id", prospects.slice(0, 1000)).gte("created_at", w.from); replies = new Set((inn ?? []).map((m) => m.prospect_id)).size; }
  return { sends: sent.length, opens: sent.filter((m) => m.opened_at).length, replies };
}

export async function crmMetrics(db: SupabaseClient, tag: string | null, w: Window) {
  if (!tag) return { calls: 0, booked: 0, won: 0, revenue: 0 };
  const { data: leads } = await db.from("crm_leads").select("id").contains("tags", [tag]).limit(5000);
  const ids = (leads ?? []).map((l) => l.id as string); if (!ids.length) return { calls: 0, booked: 0, won: 0, revenue: 0 };
  const chunk = ids.slice(0, 1000);
  const [{ count: calls }, { count: booked }, { data: rev }] = await Promise.all([
    db.from("crm_calls").select("id", { count: "exact", head: true }).in("lead_id", chunk).gte("started_at", w.from).lt("started_at", w.to),
    db.from("crm_meetings").select("id", { count: "exact", head: true }).in("lead_id", chunk).gte("created_at", w.from).lt("created_at", w.to),
    db.from("revenue_events").select("amount").in("lead_id", chunk).is("reversed_at", null).gte("occurred_at", w.from).lt("occurred_at", w.to),
  ]);
  return { calls: calls ?? 0, booked: booked ?? 0, won: (rev ?? []).length, revenue: (rev ?? []).reduce((a, r) => a + Number(r.amount ?? 0), 0) };
}

export type VariantRow = { id: string; name: string; template_key: string | null; lead_tag: string | null; subject: string | null; body: string | null; notes: string | null };
export async function campaignMetrics(db: SupabaseClient, c: { audience_tag: string | null; start_date: string | null; end_date: string | null; created_at: string; status: string }, variants: VariantRow[]) {
  if (c.status === "draft") return { total: EMPTY_METRICS, perVariant: variants.map((v) => ({ id: v.id, m: EMPTY_METRICS })) };
  const w = windowOf(c);
  const perVariant = await Promise.all(variants.map(async (v) => ({ id: v.id, m: { ...EMPTY_METRICS, ...(await emailMetrics(db, v.template_key, w)), ...(v.lead_tag ? await crmMetrics(db, v.lead_tag, w) : {}) } as Metrics })));
  const email = perVariant.reduce((a, v) => ({ sends: a.sends + v.m.sends, opens: a.opens + v.m.opens, replies: a.replies + v.m.replies }), { sends: 0, opens: 0, replies: 0 });
  const crm = await crmMetrics(db, c.audience_tag, w); // campaign audience (all variants' leads carry the campaign tag too)
  return { total: { ...email, ...crm } as Metrics, perVariant };
}
