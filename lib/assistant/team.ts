// Team assistant — Layer 1 executors. Every read and write runs on the
// SESSION client, so crm_* RLS (owner: everything; rep: own assigned leads)
// decides access exactly like the dashboard pages. Writes only ever return a
// proposal; executeTeam() runs it after the user confirms.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Routed } from "./router";
import type { PendingAction, Reply } from "./types";
import { STAGE_LABEL, stageLabel } from "@/lib/crm/stages";
import { sendWindowState, SEND_WINDOWS } from "@/lib/outbound/sendWindow";

export type TeamUser = { id: string; role: string; name: string };
type Lead = { id: string; business_name: string | null; city: string | null; state: string | null; pipeline_stage: string; tags?: string[] | null; phone?: string | null; assigned_rep?: string | null; updated_at?: string; created_at?: string };

const ACTIVE = ["contacted", "interested", "follow_up", "meeting_booked", "meeting_completed", "proposal"];
const STATE_NAME: Record<string, string> = { AL: "Alabama", AZ: "Arizona", CA: "California", CO: "Colorado", FL: "Florida", GA: "Georgia", IL: "Illinois", NC: "North Carolina", NV: "Nevada", NY: "New York", OH: "Ohio", OK: "Oklahoma", SC: "South Carolina", TN: "Tennessee", TX: "Texas", UT: "Utah", VA: "Virginia", WA: "Washington" };
const PAGES: Record<string, string> = { dashboard: "/team/dashboard", leads: "/team/leads", pipeline: "/team/pipeline", calls: "/team/calls", meetings: "/team/meetings", calendar: "/team/calendar", "follow-ups": "/team/follow-ups", followups: "/team/follow-ups", "follow ups": "/team/follow-ups", outbound: "/team/outbound", research: "/team/research", audits: "/team/audits", "work plan": "/team/work-plan", leaderboard: "/team/leaderboard", revenue: "/team/charts", timesheets: "/team/clock", notes: "/team/notes", activity: "/team/activity", settings: "/team/settings", integrations: "/team/integrations", team: "/team/team", "content lab": "/team/content-lab", "give hyperagent": "/team/prompts", "agent tasks": "/team/tasks", "client projects": "/team/projects" };

const fmt = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + " ET" : "—");
const where = (l: Pick<Lead, "city" | "state">) => [l.city, l.state].filter(Boolean).join(", ");
const leadItem = (l: Lead) => ({ label: l.business_name || "Unnamed lead", sub: [where(l), stageLabel(l.pipeline_stage)].filter(Boolean).join(" · "), href: `/team/leads/${l.id}` });
const esc = (s: string) => s.replace(/[%_\\]/g, (c) => `\\${c}`);
const isOwner = (me: TeamUser) => me.role === "owner";
const etDayStart = (offsetDays = 0) => { const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()).map((x) => [x.type, x.value])); const d = new Date(Date.UTC(+p.year, +p.month - 1, +p.day + offsetDays, 4)); return d.toISOString(); }; // 00:00 EDT ≈ 04:00Z (EST drift ≤1h is fine for counts)

export const TEAM_HELP: Reply = {
  text: "I can answer questions and make changes in the dashboard. Reads are instant; anything that changes data asks you first.",
  suggestions: ["Brief me", "How many FL leads are in New?", "Show my pipeline", "Who do I call today?", "Any stuck deals?", "Add a follow-up for Acme Roofing tomorrow at 2pm", "Move Acme Roofing to Contacted", "Tag Acme Roofing with priority-dossier"],
};

async function findLeads(db: SupabaseClient, name: string | undefined, id: string | undefined): Promise<Lead[]> {
  const cols = "id, business_name, city, state, pipeline_stage, tags, phone, assigned_rep, updated_at, created_at";
  if (id) { const { data } = await db.from("crm_leads").select(cols).eq("id", id).limit(1); return (data ?? []) as Lead[]; }
  const q = (name ?? "").trim(); if (q.length < 2) return [];
  const { data } = await db.from("crm_leads").select(cols).eq("archived", false).ilike("business_name", `%${esc(q)}%`).order("updated_at", { ascending: false }).limit(8);
  const rows = (data ?? []) as Lead[];
  const exact = rows.filter((r) => (r.business_name ?? "").toLowerCase() === q.toLowerCase());
  return exact.length === 1 ? exact : rows;
}

/** One lead or a reply asking which / saying none. `again` rebuilds the user's command with a lead:<id> pin. */
async function oneLead(db: SupabaseClient, r: Routed, original: string): Promise<Lead | Reply> {
  if (!r.slots.lead && !r.slots.leadId) return { text: "Which lead? Say the business name, e.g. “… for Acme Roofing”." };
  const rows = await findLeads(db, r.slots.lead, r.slots.leadId);
  if (rows.length === 0) return { text: `I couldn't find a lead matching “${r.slots.lead}”. (Reps only see leads assigned to them.)`, suggestions: ["List leads in New"] };
  if (rows.length > 1) return { text: `${rows.length} leads match “${r.slots.lead}”. Which one?`, options: rows.slice(0, 6).map((l) => ({ label: `${l.business_name} · ${where(l) || stageLabel(l.pipeline_stage)}`, message: `${original.replace(/\s*lead:[0-9a-f-]{36}/i, "")} lead:${l.id}` })) };
  return rows[0];
}

function propose(summary: string, action: PendingAction, sign: (a: PendingAction) => string): Reply {
  return { text: summary, confirm: { summary, action, token: sign(action) } };
}

function applyLeadFilters<T>(q: T, s: Routed["slots"]): T {
  let x = q as unknown as { eq: Function; or: Function; contains: Function };
  if (s.stage) x = x.eq("pipeline_stage", s.stage);
  if (s.state) x = x.or(`state.ilike.${s.state},state.ilike.${STATE_NAME[s.state] ?? s.state},group_key.ilike.%${s.state}%`);
  if (s.tag) x = x.contains("tags", [s.tag]);
  return x as unknown as T;
}
const filterLabel = (s: Routed["slots"]) => [s.state, s.stage ? `in ${STAGE_LABEL[s.stage] ?? s.stage}` : null, s.tag ? `tagged ${s.tag}` : null].filter(Boolean).join(" ");

export async function runTeam(db: SupabaseClient, me: TeamUser, r: Routed, original: string, sign: (a: PendingAction) => string): Promise<Reply> {
  const s = r.slots;
  switch (r.intent) {
    case "help": return TEAM_HELP;
    case "greeting": return { ...(await briefing(db, me)), text: `Hey ${me.name.split(" ")[0]}. ${(await briefing(db, me)).text}` };
    case "briefing": return briefing(db, me);
    case "navigate": { const href = PAGES[(s.text ?? "").replace(/-/g, " ")] ?? PAGES[s.text ?? ""]; return href ? { text: "Here you go.", links: [{ label: `Open ${s.text}`, href }] } : TEAM_HELP; }

    case "lead_count": {
      const q = applyLeadFilters(db.from("crm_leads").select("id", { count: "exact", head: true }).eq("archived", false), s);
      const { count, error } = await q; if (error) return { text: `Couldn't count leads: ${error.message}` };
      const label = filterLabel(s);
      return { text: `${count ?? 0} lead${count === 1 ? "" : "s"}${label ? ` ${label}` : ""}${isOwner(me) ? "" : " assigned to you"}.`, suggestions: [`List ${label || "leads"}`.trim(), "Show my pipeline"] };
    }
    case "list_leads": case "recent_leads": {
      let q = db.from("crm_leads").select("id, business_name, city, state, pipeline_stage, updated_at", { count: "exact" }).eq("archived", false);
      if (r.intent === "recent_leads") q = q.gte("created_at", /week/.test(original.toLowerCase()) ? etDayStart(-6) : /yesterday/.test(original.toLowerCase()) ? etDayStart(-1) : etDayStart(0));
      q = applyLeadFilters(q, s);
      const { data, count } = await q.order("updated_at", { ascending: false }).limit(15);
      const rows = (data ?? []) as Lead[];
      return { text: rows.length ? `${count} lead${count === 1 ? "" : "s"}${filterLabel(s) ? ` ${filterLabel(s)}` : ""}${(count ?? 0) > 15 ? " — newest 15:" : ":"}` : "No leads match.", items: rows.map(leadItem), links: [{ label: "Open Leads", href: s.tag ? `/team/leads?tag=${encodeURIComponent(s.tag)}` : "/team/leads" }] };
    }
    case "lead_details": {
      const l = await oneLead(db, r, original); if ("text" in l) return l;
      const [{ data: fu }, { data: act }] = await Promise.all([
        db.from("crm_followups").select("due_at").eq("lead_id", l.id).eq("status", "open").order("due_at").limit(1),
        db.from("crm_activities").select("description, created_at").eq("lead_id", l.id).order("created_at", { ascending: false }).limit(1),
      ]);
      const lines = [`Stage: ${stageLabel(l.pipeline_stage)}`, where(l) && `Location: ${where(l)}`, l.phone && `Phone: ${l.phone}`, l.tags?.length ? `Tags: ${l.tags.join(", ")}` : null, `Next follow-up: ${fu?.[0] ? fmt(fu[0].due_at as string) : "none"}`, act?.[0] ? `Last activity: ${act[0].description} (${fmt(act[0].created_at as string)})` : null].filter(Boolean) as string[];
      return { text: `${l.business_name}`, items: lines.map((x) => ({ label: x })), links: [{ label: "Open lead", href: `/team/leads/${l.id}` }, { label: "Call screen", href: `/team/leads/${l.id}/call` }], suggestions: [`Add a follow-up for ${l.business_name} tomorrow at 10am`, `Move ${l.business_name} to Contacted`] };
    }
    case "pipeline_summary": {
      const { data } = await applyLeadFilters(db.from("crm_leads").select("pipeline_stage").eq("archived", false), { state: s.state }).limit(10000);
      const counts = new Map<string, number>(); for (const row of data ?? []) counts.set(row.pipeline_stage as string, (counts.get(row.pipeline_stage as string) ?? 0) + 1);
      const items = Object.keys(STAGE_LABEL).filter((k) => counts.get(k)).map((k) => ({ label: `${STAGE_LABEL[k]}: ${counts.get(k)}` }));
      return { text: `Pipeline${s.state ? ` (${s.state})` : ""}${isOwner(me) ? "" : " — your leads"}: ${(data ?? []).length} open leads.`, items, links: [{ label: "Open Pipeline", href: "/team/pipeline" }] };
    }
    case "stuck_deals": {
      const days = s.days ?? 7; const cutoff = new Date(Date.now() - days * 864e5).toISOString();
      const { data, count } = await db.from("crm_leads").select("id, business_name, city, state, pipeline_stage, updated_at", { count: "exact" }).eq("archived", false).in("pipeline_stage", ACTIVE).lt("updated_at", cutoff).order("updated_at").limit(10);
      const rows = (data ?? []) as Lead[];
      return { text: rows.length ? `${count} active deal${count === 1 ? "" : "s"} with no movement in ${days}+ days (oldest first):` : `No active deals stuck for ${days}+ days.`, items: rows.map((l) => ({ ...leadItem(l), sub: `${leadItem(l).sub} · last touched ${fmt(l.updated_at)}` })) };
    }
    case "followups_today": case "followups_overdue": case "followups_upcoming": {
      let q = db.from("crm_followups").select("id, lead_id, due_at, reason").eq("status", "open");
      if (r.intent === "followups_overdue") q = q.lt("due_at", new Date().toISOString());
      else if (r.intent === "followups_today") q = q.gte("due_at", etDayStart(0)).lt("due_at", etDayStart(1));
      else q = q.gte("due_at", new Date().toISOString()).lt("due_at", etDayStart(7));
      if (!isOwner(me)) q = q.eq("rep_id", me.id);
      const { data } = await q.order("due_at").limit(20);
      const rows = data ?? []; const names = await leadNames(db, rows.map((x) => x.lead_id as string));
      const what = r.intent === "followups_overdue" ? "overdue" : r.intent === "followups_today" ? "due today" : "in the next 7 days";
      return { text: rows.length ? `${rows.length} follow-up${rows.length === 1 ? "" : "s"} ${what}:` : `No follow-ups ${what}.`, items: rows.map((f) => ({ label: names.get(f.lead_id as string) ?? "Lead", sub: `${fmt(f.due_at as string)}${f.reason ? ` · ${f.reason}` : ""}`, href: `/team/leads/${f.lead_id}` })), links: [{ label: "Open Follow-Ups", href: "/team/follow-ups" }] };
    }
    case "meetings_today": case "meetings_upcoming": {
      let q = db.from("crm_meetings").select("id, lead_id, scheduled_at, contact_name, status").in("status", ["booked", "rescheduled"]);
      q = r.intent === "meetings_today" ? q.gte("scheduled_at", etDayStart(0)).lt("scheduled_at", etDayStart(1)) : q.gte("scheduled_at", new Date().toISOString()).lt("scheduled_at", etDayStart(14));
      if (!isOwner(me)) q = q.eq("rep_id", me.id);
      const { data } = await q.order("scheduled_at").limit(20);
      const rows = data ?? []; const names = await leadNames(db, rows.map((x) => x.lead_id as string));
      return { text: rows.length ? `${rows.length} meeting${rows.length === 1 ? "" : "s"} ${r.intent === "meetings_today" ? "today" : "in the next 2 weeks"}:` : `No meetings ${r.intent === "meetings_today" ? "today" : "coming up"}.`, items: rows.map((m) => ({ label: names.get(m.lead_id as string) ?? "Lead", sub: `${fmt(m.scheduled_at as string)}${m.contact_name ? ` · ${m.contact_name}` : ""}`, href: `/team/leads/${m.lead_id}` })), links: [{ label: "Open Calendar", href: "/team/calendar" }] };
    }
    case "calls_today": {
      const { data } = await db.from("crm_calls").select("outcome").eq("rep_id", me.id).gte("started_at", etDayStart(0));
      const by = new Map<string, number>(); for (const c of data ?? []) { const k = (c.outcome as string | null) ?? "in progress"; by.set(k, (by.get(k) ?? 0) + 1); }
      return { text: `You've made ${(data ?? []).length} call${(data ?? []).length === 1 ? "" : "s"} today.`, items: Array.from(by.entries()).map(([k, n]) => ({ label: `${k.replace(/_/g, " ")}: ${n}` })) };
    }
    case "my_stats": {
      const since = etDayStart(-6);
      const [{ count: calls }, { count: booked }, { data: won }] = await Promise.all([
        db.from("crm_calls").select("id", { count: "exact", head: true }).eq("rep_id", me.id).gte("started_at", since),
        db.from("crm_meetings").select("id", { count: "exact", head: true }).eq("rep_id", me.id).gte("created_at", since),
        db.from("revenue_events").select("amount").eq("rep_id", me.id).is("reversed_at", null).gte("occurred_at", since),
      ]);
      const rev = (won ?? []).reduce((a, x) => a + Number(x.amount ?? 0), 0);
      return { text: "Your last 7 days:", items: [{ label: `Calls: ${calls ?? 0}` }, { label: `Meetings booked: ${booked ?? 0}` }, { label: `Closed: ${(won ?? []).length} ($${rev.toLocaleString()})` }], links: [{ label: "Leaderboard", href: "/team/leaderboard" }] };
    }
    case "won_deals": {
      const since = etDayStart(-(Math.max(1, s.days ?? 7) - 1));
      let q = db.from("revenue_events").select("amount, lead_id, occurred_at").is("reversed_at", null).gte("occurred_at", since); if (!isOwner(me)) q = q.eq("rep_id", me.id);
      const { data } = await q.order("occurred_at", { ascending: false }).limit(20); const rows = data ?? []; const names = await leadNames(db, rows.map((x) => x.lead_id as string));
      return { text: rows.length ? `${rows.length} closed, $${rows.reduce((a, x) => a + Number(x.amount ?? 0), 0).toLocaleString()} total:` : "Nothing closed in that window yet.", items: rows.map((x) => ({ label: names.get(x.lead_id as string) ?? "Lead", sub: `$${Number(x.amount ?? 0).toLocaleString()} · ${fmt(x.occurred_at as string)}` })) };
    }
    case "outbound_status": {
      if (!isOwner(me)) return { text: "Outbound is owner-only." };
      const { data: msgs } = await db.from("outbound_messages").select("status, template_key");
      const by = new Map<string, number>(); for (const m of msgs ?? []) by.set(m.status as string, (by.get(m.status as string) ?? 0) + 1);
      const { count: prospects } = await db.from("outbound_prospects").select("id", { count: "exact", head: true });
      const w = SEND_WINDOWS[0]; const st = w ? sendWindowState(w.templateKeys[0]) : { state: "none" as const };
      return { text: `Outbound: ${prospects ?? 0} prospects.`, items: [{ label: `Waiting for approval: ${by.get("pending_approval") ?? 0}` }, { label: `Approved (held for window): ${by.get("approved") ?? 0}` }, { label: `Sent: ${by.get("sent") ?? 0}` }, { label: `Failed: ${by.get("failed") ?? 0}` }, ...(w ? [{ label: `Send window ${w.label}: ${st.state === "open" ? "OPEN now" : st.state === "before" ? "not open yet" : "closed"}` }] : [])], links: [{ label: "Open Outbound", href: "/team/outbound" }] };
    }
    case "research_status": {
      const { data } = await db.from("crm_research_jobs").select("status").gte("created_at", etDayStart(-6));
      const by = new Map<string, number>(); for (const j of data ?? []) by.set(j.status as string, (by.get(j.status as string) ?? 0) + 1);
      return { text: `Research jobs, last 7 days: ${(data ?? []).length}.`, items: Array.from(by.entries()).map(([k, n]) => ({ label: `${k}: ${n}` })), links: [{ label: "Research Queue", href: "/team/research" }] };
    }
    case "agent_tasks": {
      if (!isOwner(me)) return { text: "Agent tasks are owner-only." };
      const [{ data: tasks }, { count: queued }] = await Promise.all([
        db.from("agent_tasks").select("title, owner_agent, status, priority").in("status", ["open", "claimed", "in_progress", "in_review", "blocked"]).order("created_at", { ascending: false }).limit(10),
        db.from("prompt_cards").select("id", { count: "exact", head: true }).eq("status", "queued"),
      ]);
      return { text: `${(tasks ?? []).length} open agent task${(tasks ?? []).length === 1 ? "" : "s"} · ${queued ?? 0} prompt${queued === 1 ? "" : "s"} queued for HyperAgent.`, items: (tasks ?? []).map((t) => ({ label: t.title as string, sub: `${t.owner_agent} · ${t.status} · ${t.priority}` })), links: [{ label: "Agent Tasks", href: "/team/tasks" }, { label: "Give HyperAgent", href: "/team/prompts" }] };
    }
    case "tag_list": {
      const { data } = await db.from("crm_leads").select("tags").eq("archived", false).limit(10000);
      const by = new Map<string, number>(); for (const l of data ?? []) for (const t of (l.tags as string[] | null) ?? []) by.set(t, (by.get(t) ?? 0) + 1);
      const rows = Array.from(by.entries()).sort((a, b) => b[1] - a[1]);
      return { text: rows.length ? `${rows.length} tags in use:` : "No tags yet.", items: rows.slice(0, 20).map(([t, n]) => ({ label: `${t}: ${n}`, href: `/team/leads?tag=${encodeURIComponent(t)}` })) };
    }

    // ---------- writes → proposal ----------
    case "move_stage": {
      const l = await oneLead(db, r, original); if ("text" in l) return l;
      if (s.stage === "won") return { text: `Marking a deal Won needs the plan that was sold, so do that on the board.`, links: [{ label: "Open Pipeline", href: "/team/pipeline" }] };
      if (l.pipeline_stage === s.stage) return { text: `${l.business_name} is already in ${stageLabel(s.stage)}.` };
      return propose(`Move ${l.business_name}${where(l) ? ` (${where(l)})` : ""} from ${stageLabel(l.pipeline_stage)} → ${stageLabel(s.stage)}?`, { intent: "move_stage", args: { leadId: l.id, stage: s.stage!, from: l.pipeline_stage } }, sign);
    }
    case "add_followup": {
      const l = await oneLead(db, r, original); if ("text" in l) return l;
      if (!s.dueAt) return { text: `When should the follow-up for ${l.business_name} be?`, options: ["tomorrow at 10am", "tomorrow at 2pm", "in 2 days", "in 3 days"].map((w) => ({ label: w, message: `Add a follow-up for ${l.business_name} ${w} lead:${l.id}` })) };
      return propose(`Add a follow-up for ${l.business_name} on ${fmt(s.dueAt)}?`, { intent: "add_followup", args: { leadId: l.id, dueAt: s.dueAt } }, sign);
    }
    case "complete_followup": {
      const l = await oneLead(db, r, original); if ("text" in l) return l;
      let q = db.from("crm_followups").select("id, due_at").eq("lead_id", l.id).eq("status", "open"); if (!isOwner(me)) q = q.eq("rep_id", me.id);
      const { data } = await q.order("due_at").limit(1);
      if (!data?.[0]) return { text: `${l.business_name} has no open follow-up.` };
      return propose(`Mark the follow-up for ${l.business_name} (due ${fmt(data[0].due_at as string)}) done?`, { intent: "complete_followup", args: { followupId: data[0].id as string, leadId: l.id } }, sign);
    }
    case "add_note": {
      const l = await oneLead(db, r, original); if ("text" in l) return l;
      return propose(`Add this note to ${l.business_name}? “${s.text}”`, { intent: "add_note", args: { leadId: l.id, note: s.text ?? "" } }, sign);
    }
    case "tag_lead": case "untag_lead": {
      const l = await oneLead(db, r, original); if ("text" in l) return l;
      const has = (l.tags ?? []).includes(s.tag!);
      if (r.intent === "tag_lead" && has) return { text: `${l.business_name} is already tagged ${s.tag}.` };
      if (r.intent === "untag_lead" && !has) return { text: `${l.business_name} isn't tagged ${s.tag}.` };
      return propose(`${r.intent === "tag_lead" ? "Tag" : "Remove tag"} ${s.tag} ${r.intent === "tag_lead" ? "on" : "from"} ${l.business_name}?`, { intent: r.intent, args: { leadId: l.id, tag: s.tag! } }, sign);
    }
    case "assign_lead": {
      if (!isOwner(me)) return { text: "Only an owner can reassign leads." };
      const l = await oneLead(db, r, original); if ("text" in l) return l;
      const { data: reps } = await db.from("users").select("id, full_name, email").not("team_role", "is", null).eq("team_status", "active");
      const q = (s.rep ?? "").toLowerCase();
      const hit = (reps ?? []).filter((u) => `${u.full_name ?? ""} ${u.email ?? ""}`.toLowerCase().includes(q));
      if (hit.length !== 1) return { text: hit.length ? `More than one teammate matches “${s.rep}”.` : `No active teammate matches “${s.rep}”.`, options: (hit.length ? hit : reps ?? []).slice(0, 6).map((u) => ({ label: (u.full_name || u.email) as string, message: `Assign ${l.business_name} to ${u.full_name || u.email} lead:${l.id}` })) };
      return propose(`Assign ${l.business_name} to ${hit[0].full_name || hit[0].email}?`, { intent: "assign_lead", args: { leadId: l.id, repId: hit[0].id as string } }, sign);
    }
    case "archive_lead": {
      const l = await oneLead(db, r, original); if ("text" in l) return l;
      return propose(`Archive ${l.business_name}${where(l) ? ` (${where(l)})` : ""}? It leaves the active lists; you can unarchive it from Leads → Show Archived.`, { intent: "archive_lead", args: { leadId: l.id } }, sign);
    }
  }
  return TEAM_HELP;
}

async function leadNames(db: SupabaseClient, ids: string[]) {
  const uniq = Array.from(new Set(ids.filter(Boolean))); const m = new Map<string, string>(); if (!uniq.length) return m;
  const { data } = await db.from("crm_leads").select("id, business_name").in("id", uniq);
  for (const l of data ?? []) m.set(l.id as string, (l.business_name as string) || "Unnamed lead");
  return m;
}

/** Proactive briefing: overdue follow-ups, today's follow-ups and meetings, stuck deals (+ outbound approvals for owners). */
export async function briefing(db: SupabaseClient, me: TeamUser): Promise<Reply> {
  const now = new Date().toISOString(); const cutoff = new Date(Date.now() - 7 * 864e5).toISOString();
  const mine = <T>(q: T) => (isOwner(me) ? q : (q as unknown as { eq: Function }).eq("rep_id", me.id) as unknown as T);
  const [{ count: overdue }, { count: today }, { count: meetings }, { count: stuck }, outbound] = await Promise.all([
    mine(db.from("crm_followups").select("id", { count: "exact", head: true }).eq("status", "open").lt("due_at", now)),
    mine(db.from("crm_followups").select("id", { count: "exact", head: true }).eq("status", "open").gte("due_at", now).lt("due_at", etDayStart(1))),
    mine(db.from("crm_meetings").select("id", { count: "exact", head: true }).in("status", ["booked", "rescheduled"]).gte("scheduled_at", etDayStart(0)).lt("scheduled_at", etDayStart(1))),
    db.from("crm_leads").select("id", { count: "exact", head: true }).eq("archived", false).in("pipeline_stage", ACTIVE).lt("updated_at", cutoff),
    isOwner(me) ? db.from("outbound_messages").select("id", { count: "exact", head: true }).eq("status", "pending_approval") : Promise.resolve({ count: null }),
  ]);
  const items = [
    { label: `${overdue ?? 0} overdue follow-up${overdue === 1 ? "" : "s"}`, href: "/team/follow-ups" },
    { label: `${today ?? 0} follow-up${today === 1 ? "" : "s"} still due today`, href: "/team/follow-ups" },
    { label: `${meetings ?? 0} meeting${meetings === 1 ? "" : "s"} today`, href: "/team/calendar" },
    { label: `${stuck ?? 0} active deal${stuck === 1 ? "" : "s"} untouched 7+ days`, href: "/team/pipeline" },
    ...(outbound.count != null ? [{ label: `${outbound.count} outbound email${outbound.count === 1 ? "" : "s"} waiting for approval`, href: "/team/outbound" }] : []),
  ];
  const urgent = (overdue ?? 0) > 0 ? "Start with the overdue follow-ups." : (meetings ?? 0) > 0 ? "You have meetings today." : "Nothing urgent — good time to dial.";
  return { text: `Here's where things stand. ${urgent}`, items, suggestions: [(overdue ?? 0) > 0 ? "Show overdue follow-ups" : "Who do I call today?", "Any stuck deals?", "Show my pipeline"] };
}

/** Runs a confirmed write. Session client → RLS still applies (a rep can't touch another rep's lead). */
export async function executeTeam(db: SupabaseClient, me: TeamUser, a: PendingAction): Promise<Reply> {
  const g = (k: string) => String(a.args[k] ?? "");
  const nowIso = new Date().toISOString();
  const leadName = async (id: string) => (await db.from("crm_leads").select("business_name").eq("id", id).maybeSingle()).data?.business_name ?? "the lead";
  switch (a.intent) {
    case "move_stage": {
      const { data: lead } = await db.from("crm_leads").select("pipeline_stage, business_name").eq("id", g("leadId")).single();
      if (!lead) return { text: "That lead isn't accessible to you." };
      if (g("stage") === "won") return { text: "Won needs a plan — use the Pipeline board." };
      const { error } = await db.from("crm_leads").update({ pipeline_stage: g("stage"), updated_at: nowIso }).eq("id", g("leadId"));
      if (error) return { text: `Couldn't move it: ${error.message}` };
      await db.from("crm_pipeline_history").insert({ lead_id: g("leadId"), from_stage: lead.pipeline_stage, to_stage: g("stage"), changed_by: me.id });
      await db.from("crm_activities").insert({ lead_id: g("leadId"), rep_id: me.id, activity_type: "pipeline_changed", description: `Moved from ${String(lead.pipeline_stage).replace(/_/g, " ")} to ${g("stage").replace(/_/g, " ")} (assistant)` });
      return { text: `Done — ${lead.business_name} is now in ${stageLabel(g("stage"))}.`, links: [{ label: "Open lead", href: `/team/leads/${g("leadId")}` }] };
    }
    case "add_followup": {
      const { data: fu, error } = await db.from("crm_followups").insert({ lead_id: g("leadId"), rep_id: me.id, created_by: me.id, followup_type: "CALL", due_at: g("dueAt"), timezone: "America/New_York", creator_timezone: "America/New_York", reason: "Added via assistant" }).select("id").single();
      if (error || !fu) return { text: `Couldn't add it: ${error?.message ?? "not allowed"}` };
      await db.from("crm_activities").insert({ lead_id: g("leadId"), rep_id: me.id, activity_type: "follow_up_created", description: "Follow-up created (call, assistant)" });
      await db.from("crm_schedule_audit_log").insert({ entity_type: "followup", entity_id: fu.id, action: "created", new_scheduled_at: g("dueAt"), employee_timezone: "America/New_York", actor_id: me.id, detail: "Created via dashboard assistant" });
      return { text: `Follow-up set for ${await leadName(g("leadId"))} on ${fmt(g("dueAt"))}.`, links: [{ label: "Follow-Ups", href: "/team/follow-ups" }] };
    }
    case "complete_followup": {
      const { error } = await db.from("crm_followups").update({ status: "completed", completed_at: nowIso }).eq("id", g("followupId")).eq("status", "open");
      if (error) return { text: `Couldn't update it: ${error.message}` };
      await db.from("crm_activities").insert({ lead_id: g("leadId"), rep_id: me.id, activity_type: "follow_up_updated", description: "Follow-up marked completed (assistant)" });
      return { text: `Marked done for ${await leadName(g("leadId"))}.` };
    }
    case "add_note": {
      const { error } = await db.from("crm_notes").insert({ lead_id: g("leadId"), author_id: me.id, note_type: "manual", note: g("note") });
      if (error) return { text: `Couldn't save the note: ${error.message}` };
      await db.from("crm_activities").insert({ lead_id: g("leadId"), rep_id: me.id, activity_type: "note_added", description: "Note added (assistant)" });
      return { text: `Note added to ${await leadName(g("leadId"))}.`, links: [{ label: "Open lead", href: `/team/leads/${g("leadId")}` }] };
    }
    case "tag_lead": case "untag_lead": {
      const { data: lead } = await db.from("crm_leads").select("tags, business_name").eq("id", g("leadId")).single();
      if (!lead) return { text: "That lead isn't accessible to you." };
      const cur = new Set<string>((lead.tags as string[] | null) ?? []); a.intent === "tag_lead" ? cur.add(g("tag")) : cur.delete(g("tag"));
      const { error } = await db.from("crm_leads").update({ tags: Array.from(cur), updated_at: nowIso }).eq("id", g("leadId"));
      if (error) return { text: `Couldn't update tags: ${error.message}` };
      return { text: `${a.intent === "tag_lead" ? "Tagged" : "Removed tag"} ${g("tag")} ${a.intent === "tag_lead" ? "on" : "from"} ${lead.business_name}.` };
    }
    case "assign_lead": {
      if (!isOwner(me)) return { text: "Only an owner can reassign leads." };
      const { error } = await db.from("crm_leads").update({ assigned_rep: g("repId"), updated_at: nowIso }).eq("id", g("leadId"));
      if (error) return { text: `Couldn't reassign: ${error.message}` };
      await db.from("crm_activities").insert({ lead_id: g("leadId"), rep_id: me.id, activity_type: "lead_reassigned", description: "Lead reassigned (assistant)" });
      return { text: `Reassigned ${await leadName(g("leadId"))}.` };
    }
    case "archive_lead": {
      const { error } = await db.from("crm_leads").update({ archived: true, archived_at: nowIso, updated_at: nowIso }).eq("id", g("leadId"));
      if (error) return { text: `Couldn't archive: ${error.message}` };
      await db.from("crm_activities").insert({ lead_id: g("leadId"), rep_id: me.id, activity_type: "lead_archived", description: "Lead archived (assistant)" });
      return { text: `Archived ${await leadName(g("leadId"))}.` };
    }
  }
  return { text: "I don't know how to do that yet." };
}
