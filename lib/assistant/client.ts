// Client assistant — Layer 1 executors for the customer portal (/dashboard).
//
// DATA ISOLATION (non-negotiable): `ctx` is resolved on the server from the
// signed-in user (their own business, never an id from the request). Every
// read goes through `own()` / `ownBiz()` (or a server-side dep pinned to ctx) which pin the
// query to ctx — and runs on the SESSION client, so database RLS ("business
// owner reads own rows") is a second, independent lock. Writes re-check that
// the target row belongs to ctx.businessId before touching it. This module
// never reads crm_* / agent_* / team tables. tests/lib/assistantIsolation.test.ts
// enforces all of this.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Routed } from "./router";
import type { PendingAction, Reply } from "./types";

export type ClientCtx = { businessId: string; userId: string; businessName: string; planLabel: string; label: string };
export type ClientDeps = {
  db: SupabaseClient;          // session client (RLS)
  ctx: ClientCtx;
  onboarding: () => Promise<{ current: number; percent: number; completed: boolean; remaining: { no: number; slug: string; title: string; short: string; locked: boolean }[] }>;
  credits: () => Promise<{ balance: number; allotment: number; monthlySpent: number; monthlyRemaining: number; topupBalance: number }>;
  prices: { key: string; label: string; credits: number }[];
  connections: () => Promise<{ provider: string; status: string; account_label: string | null }[]>; // server-side, pinned to ctx.userId
};

/** Tables a client may read — always pinned to their own business. */
export const CLIENT_TABLES = ["outbound_prospects", "outbound_messages", "outbound_bookings", "credit_transactions"] as const;
type ClientTable = (typeof CLIENT_TABLES)[number];

const fmt = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + " ET" : "—");
const esc = (s: string) => s.replace(/[%_\\]/g, (c) => `\\${c}`);
const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString();

export const CLIENT_HELP: Reply = {
  text: "I can answer questions about your account and take actions for you. Anything that changes something asks you first.",
  suggestions: ["What's left to finish setup?", "How many credits do I have?", "Any emails waiting for my approval?", "Did anyone reply?", "Show my meetings", "How many prospects do I have?"],
};

export async function runClient(d: ClientDeps, r: Routed, original: string, sign: (a: PendingAction) => string): Promise<Reply> {
  const { db, ctx } = d; const s = r.slots;
  const own = (table: ClientTable, cols: string, opts?: { count?: "exact"; head?: boolean }) => db.from(table).select(cols, opts).eq("business_id", ctx.businessId);
  const ownBiz = (cols: string) => db.from("businesses").select(cols).eq("id", ctx.businessId).eq("owner_id", ctx.userId);
  const propose = (summary: string, action: PendingAction, cost?: string): Reply => ({ text: summary, confirm: { summary, action, token: sign(action), cost } });

  switch (r.intent) {
    case "help": return CLIENT_HELP;
    case "greeting": return briefingClient(d);
    case "c_onboarding": {
      const o = await d.onboarding();
      if (o.completed || !o.remaining.length) return { text: "Setup is complete. Your agent is running.", links: [{ label: "Overview", href: "/dashboard" }] };
      const next = o.remaining.find((x) => !x.locked) ?? o.remaining[0];
      return { text: `Setup is ${o.percent}% done. Next: ${next.title} — ${next.short}`, items: o.remaining.map((x) => ({ label: x.title, sub: x.locked ? "locked until the steps before it are done" : x.short, href: `/dashboard/onboarding/${x.slug}` })), links: [{ label: `Continue: ${next.title}`, href: `/dashboard/onboarding/${next.slug}` }] };
    }
    case "c_credits": { const c = await d.credits(); return { text: `You have ${c.balance} credits: ${c.monthlyRemaining} left of this month's ${c.allotment}${c.topupBalance ? `, plus ${c.topupBalance} top-up` : ""}.`, links: [{ label: "Credits", href: "/dashboard/credits" }] }; }
    case "c_usage": {
      const { data } = await own("credit_transactions", "amount, action_key, description, created_at").eq("type", "USAGE").gte("created_at", daysAgo(30)).order("created_at", { ascending: false }).limit(200);
      const by = new Map<string, number>(); let total = 0; for (const t of (data ?? []) as unknown as { amount: number; action_key: string | null }[]) { const k = t.action_key ?? "other"; by.set(k, (by.get(k) ?? 0) - Number(t.amount)); total -= Number(t.amount); }
      return { text: `${total} credits used in the last 30 days.`, items: Array.from(by.entries()).sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ label: `${d.prices.find((p) => p.key === k)?.label ?? k}: ${n}` })), links: [{ label: "Credits", href: "/dashboard/credits" }] };
    }
    case "c_plan": return { text: `You're on ${ctx.planLabel}.`, links: [{ label: "Billing", href: "/dashboard/billing" }] };
    case "c_prices": return { text: "What each action costs in credits:", items: d.prices.filter((p) => p.credits > 0).map((p) => ({ label: `${p.label}: ${p.credits}` })) };
    case "c_approvals": {
      const { data, count } = await own("outbound_messages", "id, to_email, subject, created_at", { count: "exact" }).eq("status", "pending_approval").order("created_at").limit(10);
      const rows = (data ?? []) as unknown as { id: string; to_email: string; subject: string; created_at: string }[];
      return { text: rows.length ? `${count} email${count === 1 ? "" : "s"} waiting for your approval:` : "Nothing waiting for approval.", items: rows.map((m) => ({ label: m.subject, sub: `to ${m.to_email} · drafted ${fmt(m.created_at)}` })), options: rows.slice(0, 3).flatMap((m) => [{ label: `Approve: ${m.to_email}`, message: `approve msg:${m.id}` }, { label: `Reject: ${m.to_email}`, message: `reject msg:${m.id}` }]) };
    }
    case "c_sent": {
      const { data, count } = await own("outbound_messages", "to_email, subject, sent_at", { count: "exact" }).eq("status", "sent").gte("sent_at", daysAgo(7)).order("sent_at", { ascending: false }).limit(10);
      const rows = (data ?? []) as unknown as { to_email: string; subject: string; sent_at: string }[];
      return { text: `${count ?? 0} email${count === 1 ? "" : "s"} sent in the last 7 days.`, items: rows.map((m) => ({ label: m.subject, sub: `to ${m.to_email} · ${fmt(m.sent_at)}` })) };
    }
    case "c_replies": {
      const { data, count } = await own("outbound_messages", "to_email, subject, body_text, created_at", { count: "exact" }).eq("direction", "in").gte("created_at", daysAgo(14)).order("created_at", { ascending: false }).limit(10);
      const rows = (data ?? []) as unknown as { subject: string; body_text: string; created_at: string }[];
      return { text: rows.length ? `${count} repl${count === 1 ? "y" : "ies"} in the last 14 days:` : "No replies in the last 14 days yet.", items: rows.map((m) => ({ label: m.subject || "(no subject)", sub: `${fmt(m.created_at)} · ${(m.body_text ?? "").slice(0, 90)}` })) };
    }
    case "c_meetings": {
      const { data } = await own("outbound_bookings", "start_at, end_at, prospect_id, meet_url, status").gte("start_at", new Date().toISOString()).order("start_at").limit(10);
      const rows = (data ?? []) as unknown as { start_at: string; meet_url: string | null; status: string | null }[];
      return { text: rows.length ? `${rows.length} upcoming meeting${rows.length === 1 ? "" : "s"}:` : "No upcoming meetings yet.", items: rows.map((b) => ({ label: fmt(b.start_at), sub: b.meet_url ? "Google Meet link ready" : b.status ?? "" })) };
    }
    case "c_connections": {
      const by = new Map((await d.connections()).map((x) => [x.provider, x]));
      const line = (k: string, n: string) => { const c = by.get(k); return { label: `${n}: ${c ? `${c.status}${c.account_label ? ` (${c.account_label})` : ""}` : "not connected"}` }; };
      return { text: "Your connections:", items: [line("gmail", "Gmail"), line("google_calendar", "Google Calendar")], links: [{ label: "Integrations", href: "/dashboard/integrations" }] };
    }
    case "c_offer": { const { data } = await ownBiz("outbound_offer_line").maybeSingle(); const line = (data as { outbound_offer_line?: string | null } | null)?.outbound_offer_line; return { text: line ? `Your offer line: “${line}”` : "You haven't set an offer line yet. Every intro email uses it.", suggestions: ['Change my offer line to "…"'] }; }
    case "c_report": {
      const since = daysAgo(30);
      const [{ count: prospects }, { count: sent }, { count: replies }, { count: meetings }] = await Promise.all([
        own("outbound_prospects", "id", { count: "exact", head: true }),
        own("outbound_messages", "id", { count: "exact", head: true }).eq("status", "sent").gte("sent_at", since),
        own("outbound_messages", "id", { count: "exact", head: true }).eq("direction", "in").gte("created_at", since),
        own("outbound_bookings", "id", { count: "exact", head: true }).gte("created_at", since),
      ]);
      return { text: "Last 30 days:", items: [{ label: `Prospects on your list: ${prospects ?? 0}` }, { label: `Emails sent: ${sent ?? 0}` }, { label: `Replies: ${replies ?? 0}` }, { label: `Meetings booked: ${meetings ?? 0}` }], links: [{ label: "Progress", href: "/dashboard/progress" }] };
    }
    case "c_prospect_count": { const { count } = await own("outbound_prospects", "id", { count: "exact", head: true }); return { text: `You have ${count ?? 0} prospect${count === 1 ? "" : "s"}.` }; }
    case "c_list_prospects": case "c_find_prospect": {
      let q = own("outbound_prospects", "name, email, city, status, last_contacted_at", { count: "exact" });
      if (r.intent === "c_find_prospect" && s.lead) q = q.ilike("name", `%${esc(s.lead)}%`);
      const { data, count } = await q.order("updated_at", { ascending: false }).limit(15);
      const rows = (data ?? []) as unknown as { name: string; email: string | null; city: string | null; status: string; last_contacted_at: string | null }[];
      return { text: rows.length ? `${count} prospect${count === 1 ? "" : "s"}${s.lead ? ` matching “${s.lead}”` : ""}${(count ?? 0) > 15 ? " — newest 15:" : ":"}` : `No prospects${s.lead ? ` matching “${s.lead}”` : ""}.`, items: rows.map((p) => ({ label: p.name, sub: [p.email, p.city, p.status.replace(/_/g, " "), p.last_contacted_at ? `last contacted ${fmt(p.last_contacted_at)}` : null].filter(Boolean).join(" · ") })) };
    }

    // ---------- writes → proposal (ownership checked now AND again on execute) ----------
    case "c_approve": case "c_reject": {
      let q = own("outbound_messages", "id, to_email, subject, body_text").eq("status", "pending_approval");
      if (s.messageId) q = q.eq("id", s.messageId); else if (s.lead) q = q.ilike("to_email", `%${esc(s.lead)}%`);
      const { data } = await q.order("created_at").limit(5);
      const rows = (data ?? []) as unknown as { id: string; to_email: string; subject: string; body_text: string }[];
      if (!rows.length) return { text: "I couldn't find that draft in your approval queue.", suggestions: ["Any emails waiting for my approval?"] };
      if (rows.length > 1) return { text: "Which email?", options: rows.map((m) => ({ label: `${m.to_email} — ${m.subject}`, message: `${r.intent === "c_approve" ? "approve" : "reject"} msg:${m.id}` })) };
      const m = rows[0];
      return r.intent === "c_approve"
        ? propose(`Approve and send this email to ${m.to_email}?\n\nSubject: ${m.subject}\n\n${m.body_text.slice(0, 600)}${m.body_text.length > 600 ? "…" : ""}`, { intent: "c_approve", args: { messageId: m.id } }, "5 credits (review pass)")
        : propose(`Reject the draft to ${m.to_email} (“${m.subject}”)? It won't be sent.`, { intent: "c_reject", args: { messageId: m.id, reason: s.text ?? "Rejected in chat" } });
    }
    case "c_set_offer": {
      if (!s.text) return { text: 'What should it say? e.g. Change my offer line to "We answer every missed call and book the job."' };
      return propose(`Set your offer line to: “${s.text}”? Every new intro email will use it.`, { intent: "c_set_offer", args: { text: s.text } });
    }
    case "c_add_prospect": {
      if (!s.email || !s.name) return { text: "I need a name and an email, e.g. “add prospect Jane Doe jane@acme.com”." };
      return propose(`Add ${s.name} (${s.email}) to your prospect list?`, { intent: "c_add_prospect", args: { name: s.name, email: s.email.toLowerCase() } }, "0 credits");
    }
    case "c_support": {
      if (!s.text || s.text.length < 5) return { text: "What do you need help with? Write it out and I'll send it to the SFB Connect team." };
      return propose(`Send this to SFB Connect support? “${s.text}”`, { intent: "c_support", args: { text: s.text.slice(0, 4000) } });
    }
  }
  return CLIENT_HELP;
}

/** Proactive: next setup step, drafts waiting, low credits. */
export async function briefingClient(d: ClientDeps): Promise<Reply> {
  const [o, c, { count: pending }] = await Promise.all([
    d.onboarding(), d.credits(),
    d.db.from("outbound_messages").select("id", { count: "exact", head: true }).eq("business_id", d.ctx.businessId).eq("status", "pending_approval"),
  ]);
  const items: { label: string; href?: string }[] = [];
  if (!o.completed && o.remaining.length) { const n = o.remaining.find((x) => !x.locked) ?? o.remaining[0]; items.push({ label: `Setup ${o.percent}% — next: ${n.title}`, href: `/dashboard/onboarding/${n.slug}` }); }
  if ((pending ?? 0) > 0) items.push({ label: `${pending} email${pending === 1 ? "" : "s"} waiting for your approval` });
  if (c.allotment > 0 && c.balance <= c.allotment * 0.2) items.push({ label: `Credits are low: ${c.balance} left`, href: "/dashboard/credits" });
  return { text: items.length ? `Hi! A few things for ${d.ctx.businessName}:` : `Hi! Everything's on track for ${d.ctx.businessName}. Ask me anything about your account.`, items, suggestions: CLIENT_HELP.suggestions };
}

/** Confirmed client writes. `service` is the privileged client; every write is pinned to ctx.businessId. */
export async function executeClient(service: SupabaseClient, ctx: ClientCtx, a: PendingAction, engine: {
  approveMessage: (s: SupabaseClient, id: string, who: { id: string; label: string }, o: { andSend: boolean }) => Promise<unknown>;
  rejectMessage: (s: SupabaseClient, id: string, who: { id: string; label: string }, reason: string) => Promise<unknown>;
  addProspect: (s: SupabaseClient, input: { businessId: string; name: string; email: string; source: "manual" }, actor: { kind: "user"; id: string; label: string }) => Promise<unknown>;
}): Promise<Reply> {
  const g = (k: string) => String(a.args[k] ?? "");
  const who = { id: ctx.userId, label: ctx.label };
  const mine = async (messageId: string) => !!(await service.from("outbound_messages").select("id").eq("id", messageId).eq("business_id", ctx.businessId).maybeSingle()).data;
  switch (a.intent) {
    case "c_approve": if (!(await mine(g("messageId")))) return { text: "That draft isn't on your account." }; await engine.approveMessage(service, g("messageId"), who, { andSend: true }); return { text: "Approved — it's on its way." };
    case "c_reject": if (!(await mine(g("messageId")))) return { text: "That draft isn't on your account." }; await engine.rejectMessage(service, g("messageId"), who, g("reason")); return { text: "Rejected. It won't be sent." };
    case "c_set_offer": { const { error } = await service.from("businesses").update({ outbound_offer_line: g("text").slice(0, 300), updated_at: new Date().toISOString() }).eq("id", ctx.businessId).eq("owner_id", ctx.userId); return { text: error ? `Couldn't save: ${error.message}` : "Offer line updated." }; }
    case "c_add_prospect": await engine.addProspect(service, { businessId: ctx.businessId, name: g("name"), email: g("email"), source: "manual" }, { kind: "user", id: ctx.userId, label: ctx.label }); return { text: `Added ${g("name")} to your prospects.` };
    case "c_support": { const { error } = await service.from("support_messages").insert({ business_id: ctx.businessId, sender_role: "customer", sender_id: ctx.userId, message: g("text") }); return { text: error ? `Couldn't send: ${error.message}` : "Sent to the SFB Connect team — they'll reply in Support.", links: [{ label: "Support", href: "/dashboard/support" }] }; }
  }
  return { text: "I don't know how to do that yet." };
}
