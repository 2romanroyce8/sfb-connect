import type { ToolDef } from "./tools";
import { AgentAuthError } from "./auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { addProspect, draftMessage, enrichProspect, OutboundError, proposeMeetingSlots, bookMeeting, startSequence, InsufficientCreditsError } from "@/lib/outbound/engine";
import type { TemplateKey } from "@/lib/outbound/templates";

// Outbound tools for the agent (Atlas). Reads go through the user's RLS;
// writes go through the engine, which enforces credits and — crucially —
// never sends: the agent can enrich, draft, and book, but only a human can
// approve, and only approved messages are sent. Scope sfb:outbound:run.
const str = (d: string) => ({ type: "string", description: d });
const obj = (props: Record<string, unknown>, required: string[] = []) => ({ type: "object", properties: props, required, additionalProperties: false });
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = (v: unknown, what: string) => { const x = typeof v === "string" ? v.trim() : ""; if (!UUID_RE.test(x)) throw new AgentAuthError(404, "not_found", `No ${what} with that id is visible to this user.`); return x; };
const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");

const wrap = async <T,>(fn: () => Promise<T>): Promise<T> => {
  try { return await fn(); }
  catch (e) {
    if (e instanceof OutboundError) throw new AgentAuthError(e.status, e.code, e.message);
    if (e instanceof InsufficientCreditsError) throw new AgentAuthError(402, "insufficient_credits", e.message);
    throw e;
  }
};

/** The agent may only touch businesses the authorizing user can see (RLS answers that). */
async function visibleBusiness(ctx: Parameters<ToolDef["run"]>[0], businessId: string) {
  const { data } = await ctx.user.from("businesses").select("id").eq("id", businessId).maybeSingle();
  if (!data) throw new AgentAuthError(404, "not_found", "No business with that id is visible to this user.");
  return data.id as string;
}

export const OUTBOUND_TOOLS: ToolDef[] = [
  {
    name: "list_sfb_outbound",
    description: "Prospects, messages (with approval status) and bookings for a business's outbound pipeline. Use to see what's waiting for human approval, what was sent/opened/replied, and who to work next. Read-only.",
    scope: "sfb:outbound:run", readOnly: true,
    inputSchema: obj({ business_id: str("Business UUID") }, ["business_id"]),
    outputSchema: obj({ prospects: { type: "array" }, messages: { type: "array" }, bookings: { type: "array" } }),
    async run(ctx, args) {
      const id = await visibleBusiness(ctx, uuid(args.business_id, "business"));
      const [p, m, b] = await Promise.all([
        ctx.user.from("outbound_prospects").select("id, name, contact_name, website, email, email_source, phone_e164, city, state, category, status, enriched_at, last_contacted_at").eq("business_id", id).order("updated_at", { ascending: false }).limit(100),
        ctx.user.from("outbound_messages").select("id, prospect_id, direction, step, to_email, subject, status, template_key, approved_at, sent_at, opened_at, replied_at, created_at").eq("business_id", id).order("created_at", { ascending: false }).limit(100),
        ctx.user.from("outbound_bookings").select("id, prospect_id, start_at, end_at, meet_url, status").eq("business_id", id).order("start_at", { ascending: false }).limit(50),
      ]);
      return { prospects: p.data ?? [], messages: m.data ?? [], bookings: b.data ?? [] };
    },
  },
  {
    name: "sfb_outbound_add_prospect",
    description: "Add a prospect (business) to a customer's outbound list from facts you verified (name required; website/email/phone/city/state/category optional — never guessed). Duplicates by domain/email are rejected.",
    scope: "sfb:outbound:run",
    inputSchema: obj({ business_id: str("Business UUID"), name: str("Prospect business name"), website: str("Website URL"), email: str("Email, only if publicly stated"), phone: str("Phone"), city: str("City"), state: str("Two-letter state"), category: str("What they are, e.g. property management company"), contact_name: str("Person, only if publicly named"), finding_id: str("research_feed_findings id this came from") }, ["business_id", "name"]),
    outputSchema: obj({ prospect: { type: "object" } }),
    async run(ctx, args) {
      const id = await visibleBusiness(ctx, uuid(args.business_id, "business"));
      return wrap(async () => ({ prospect: await addProspect(createSupabaseServiceClient(), { businessId: id, name: s(args.name), website: s(args.website) || null, email: s(args.email) || null, phone: s(args.phone) || null, city: s(args.city) || null, state: s(args.state) || null, category: s(args.category) || null, contactName: s(args.contact_name) || null, findingId: s(args.finding_id) ? uuid(args.finding_id, "finding") : null }, { kind: "agent", id: ctx.clientId, label: `agent:${ctx.clientId}` }) }));
    },
  },
  {
    name: "sfb_outbound_enrich",
    description: "Read the prospect's public website (and contact page) for email, phone, city. Charges 2 credits when something is found, 0 when nothing is. Never invents contact details.",
    scope: "sfb:outbound:run",
    inputSchema: obj({ prospect_id: str("Prospect UUID") }, ["prospect_id"]),
    outputSchema: obj({ prospect: { type: "object" }, found: { type: "boolean" } }),
    async run(ctx, args) {
      const pid = uuid(args.prospect_id, "prospect");
      const { data } = await ctx.user.from("outbound_prospects").select("id").eq("id", pid).maybeSingle();
      if (!data) throw new AgentAuthError(404, "not_found", "No prospect with that id is visible to this user.");
      return wrap(() => enrichProspect(createSupabaseServiceClient(), pid, { kind: "agent", id: ctx.clientId, label: `agent:${ctx.clientId}` }));
    },
  },
  {
    name: "sfb_outbound_draft",
    description: "Write an outreach email for a prospect from the approved templates and verified facts (2 credits). The draft goes to the HUMAN approval queue — this tool never sends. Use start_sequence=true to begin the 3-step sequence (intro now, follow-ups drafted on day 3 and 7, each needing approval).",
    scope: "sfb:outbound:run",
    inputSchema: obj({ prospect_id: str("Prospect UUID"), template: { type: "string", enum: ["intro", "follow_up_1", "follow_up_2", "reply_thanks"], description: "Template (default intro)" }, start_sequence: { type: "boolean", description: "Begin the default 3-step sequence instead of a one-off draft" }, slots: str("Optional slot text for reply_thanks, e.g. 'Tue 10:00, Wed 2:00 (ET)'") }, ["prospect_id"]),
    outputSchema: obj({ message: { type: "object" } }),
    async run(ctx, args) {
      const pid = uuid(args.prospect_id, "prospect");
      const { data } = await ctx.user.from("outbound_prospects").select("id").eq("id", pid).maybeSingle();
      if (!data) throw new AgentAuthError(404, "not_found", "No prospect with that id is visible to this user.");
      const actor = { kind: "agent" as const, id: ctx.clientId, label: `agent:${ctx.clientId}` };
      return wrap(async () => ({ message: args.start_sequence === true ? await startSequence(createSupabaseServiceClient(), pid, actor) : await draftMessage(createSupabaseServiceClient(), { prospectId: pid, template: (s(args.template) || "intro") as TemplateKey, slots: s(args.slots) || null }, actor) }));
    },
  },
  {
    name: "sfb_outbound_slots",
    description: "Three open 15-minute slots on the business owner's Google Calendar over the next 7 days (business hours, owner's time zone). Use before booking or when drafting a reply with times.",
    scope: "sfb:outbound:run", readOnly: true,
    inputSchema: obj({ business_id: str("Business UUID") }, ["business_id"]),
    outputSchema: obj({ slots: { type: "array" }, timeZone: str("") }),
    async run(ctx, args) { const id = await visibleBusiness(ctx, uuid(args.business_id, "business")); return wrap(() => proposeMeetingSlots(createSupabaseServiceClient(), id)); },
  },
  {
    name: "sfb_outbound_book",
    description: "Book a meeting with a prospect on the owner's Google Calendar (5 credits). Use only after the prospect agreed to a time in a reply. The confirmation email is drafted into the approval queue — not sent by this tool.",
    scope: "sfb:outbound:run",
    inputSchema: obj({ prospect_id: str("Prospect UUID"), start: str("ISO start"), end: str("ISO end"), reply_message_id: str("The inbound message where they agreed (optional)") }, ["prospect_id", "start", "end"]),
    outputSchema: obj({ booking: { type: "object" }, event: { type: "object" }, confirmation: { type: "object" } }),
    async run(ctx, args) {
      const pid = uuid(args.prospect_id, "prospect");
      const { data } = await ctx.user.from("outbound_prospects").select("id").eq("id", pid).maybeSingle();
      if (!data) throw new AgentAuthError(404, "not_found", "No prospect with that id is visible to this user.");
      const start = new Date(s(args.start)), end = new Date(s(args.end));
      if (isNaN(+start) || isNaN(+end) || end <= start) throw new AgentAuthError(400, "bad_time", "start/end must be ISO timestamps with end after start.");
      return wrap(() => bookMeeting(createSupabaseServiceClient(), { prospectId: pid, startISO: start.toISOString(), endISO: end.toISOString(), replyToMessageId: s(args.reply_message_id) ? uuid(args.reply_message_id, "message") : null }, { kind: "agent", id: ctx.clientId, label: `agent:${ctx.clientId}` }));
    },
  },
];
