// Outbound engine: enrich → write → approve → send → track → book.
// Every charged step goes through chargeAction (spend_credits: idempotent,
// never negative, 0-credit receipt on failure) behind workAllowed. Every send
// goes through canSend() — no code path reaches Gmail without a human
// approval recorded on the row.
import type { SupabaseClient } from "@supabase/supabase-js";
import { chargeAction, workAllowed, InsufficientCreditsError } from "@/lib/billing/guards";
import { fetchSite } from "@/lib/analyzer/checks";
import { resolveBusinessName } from "@/lib/analyzer/identity";
import { marketFromHtml } from "@/lib/analyzer/checks";
import { extractMailtoEmails, extractVisibleEmails, extractPhoneNumbers, extractLinks } from "@/lib/research/htmlExtract";
import { sendGmail, listGmailMessages, getGmailMessage } from "@/lib/integrations/gmail";
import { getBusyBlocks, createCalendarEvent } from "@/lib/crm/googleCalendar";
import { emitIntegrationEvent } from "@/lib/integrations/events";
import { retryFailedDeliveries } from "@/lib/notify/retry";
import { alertOwners } from "@/lib/notify/ownerAlerts";
import { appOrigin } from "@/lib/integrations/providers";
import { canSend, dueSteps, pickEmail, proposeSlots, toE164, unsubscribeToken, isFreemailDomain, reminderDue, retryEligible, type MessageStatus } from "./gate";
import { getAccessToken } from "@/lib/integrations/connections";
import { probeCalendarConnection } from "@/lib/crm/googleCalendar";
import { sendEmail } from "@/lib/email/resend";
import { renderSource, unsubscribeFooter, DEFAULT_SEQUENCE_STEPS, yearsFromCustom, type TemplateKey, type TemplateVars } from "./templates";

export type Actor = { kind: "user" | "agent" | "system"; id: string | null; label: string };
import { OutboundError } from "./errors";
export { OutboundError };
import { resolveSource } from "./library";
import { recommendIntro, resolveStepTemplate } from "./presets";
import { sendWindowState, openWindowTemplateKeys, RELEASE_CAP_PER_TICK } from "./sendWindow";

const now = () => new Date().toISOString();
const secret = () => process.env.CALENDAR_TOKEN_ENCRYPTION_KEY || "sfb-outbound";

async function event(service: SupabaseClient, e: { businessId: string; prospectId?: string | null; messageId?: string | null; kind: string; actor: Actor; payload?: Record<string, unknown> }) {
  await service.from("outbound_events").insert({ business_id: e.businessId, prospect_id: e.prospectId ?? null, message_id: e.messageId ?? null, kind: e.kind, actor: e.actor.label, payload: e.payload ?? {} });
  emitIntegrationEvent(`outbound.${e.kind}`, { business_id: e.businessId, prospect_id: e.prospectId ?? null, message_id: e.messageId ?? null, ...(e.payload ?? {}) });
}

async function business(service: SupabaseClient, businessId: string) {
  const { data } = await service.from("businesses").select("id, legal_name, owner_id, primary_category, plan_key, outbound_offer_line, outbound_time_zone, agent_overseer_id, outbound_intro_template, icp").eq("id", businessId).maybeSingle();
  if (!data) throw new OutboundError("business_not_found", "Business not found.", 404);
  return data as { id: string; legal_name: string; owner_id: string; primary_category: string | null; plan_key: string | null; outbound_offer_line: string | null; outbound_time_zone: string; agent_overseer_id: string | null; outbound_intro_template: string | null; icp: { industries?: string[]; notes?: string | null } | null };
}

async function guard(service: SupabaseClient, businessId: string) {
  const w = await workAllowed(service, businessId);
  if (!w.allowed) throw new OutboundError(`work_paused_${w.reason}`, w.reason === "out_of_credits" ? "Out of credits — the agent is paused until credits are added." : "No active plan.", 402);
}

// ---------- prospects ----------
export type ProspectSource = "agent" | "feed" | "manual" | "upload";
export async function addProspect(service: SupabaseClient, input: { businessId: string; name: string; website?: string | null; email?: string | null; phone?: string | null; city?: string | null; state?: string | null; category?: string | null; contactName?: string | null; findingId?: string | null; source?: ProspectSource; importId?: string | null; customFields?: Record<string, string> | null }, actor: Actor) {
  let domain: string | null = null;
  if (input.website) { try { domain = new URL(/^https?:/i.test(input.website) ? input.website : `https://${input.website}`).hostname.replace(/^www\./, "").toLowerCase(); } catch { domain = null; } }
  const source: ProspectSource = input.source ?? (input.findingId ? "feed" : "manual");
  const row = { business_id: input.businessId, finding_id: input.findingId ?? null, name: input.name.trim().slice(0, 200), contact_name: input.contactName?.trim() || null, website: input.website ? (/^https?:/i.test(input.website) ? input.website : `https://${input.website}`) : null, canonical_domain: domain, email: input.email?.toLowerCase().trim() || null, email_source: input.email ? (source === "upload" ? "upload" : "manual") : null, phone_e164: input.phone ? toE164(input.phone) : null, city: input.city ?? null, state: input.state ?? null, category: input.category ?? null, created_by: actor.label, source, import_id: input.importId ?? null, custom_fields: input.customFields ?? {} };
  const { data, error } = await service.from("outbound_prospects").insert(row).select("*").single();
  if (error) { if (error.code === "23505") throw new OutboundError("duplicate", "That prospect (same domain or email) is already in this business's list.", 409); throw new Error(error.message); }
  await event(service, { businessId: input.businessId, prospectId: data.id, kind: "sourced", actor, payload: { from: source } });
  return data;
}

/** Promote accepted research-feed findings into prospects for a business (dedup by domain). */
export async function importFindings(service: SupabaseClient, businessId: string, findingIds: string[], actor: Actor) {
  const { data: findings } = await service.from("research_feed_findings").select("id, business_name, website, canonical_domain, phone_e164, city, state, category").in("id", findingIds).eq("accepted", true);
  const out: { id: string; name: string; status: "added" | "duplicate" }[] = [];
  for (const f of findings ?? []) {
    try { const p = await addProspect(service, { businessId, name: f.business_name, website: f.website, phone: f.phone_e164, city: f.city, state: f.state, category: f.category, findingId: f.id }, actor); out.push({ id: p.id, name: f.business_name, status: "added" }); }
    catch (e) { if (e instanceof OutboundError && e.code === "duplicate") out.push({ id: f.id, name: f.business_name, status: "duplicate" }); else throw e; }
  }
  return out;
}

// ---------- 1. enrich (charges outbound.prospect_enriched; 0 if nothing found) ----------
export async function enrichProspect(service: SupabaseClient, prospectId: string, actor: Actor) {
  const { data: p } = await service.from("outbound_prospects").select("*").eq("id", prospectId).maybeSingle();
  if (!p) throw new OutboundError("not_found", "Prospect not found.", 404);
  await guard(service, p.business_id);
  if (!p.website) {
    await chargeAction(service, { businessId: p.business_id, actionKey: "outbound.prospect_enriched", outcome: "failed", description: `Prospect enriched — ${p.name} (no website to read, 0 credits)`, idempotencyKey: `outbound:${p.id}:enrich:${Date.now()}`, actorId: actor.kind === "user" ? actor.id : null, resultRef: p.id });
    throw new OutboundError("no_website", "No website on file — nothing public to read.");
  }
  const home = await fetchSite(p.website);
  const pages = [home];
  if (home.ok) {
    const contact = extractLinks(home.html, home.finalUrl).find((l) => /contact|about/i.test(l) && !/\.(pdf|jpg|png)$/i.test(l));
    if (contact) pages.push(await fetchSite(contact));
  }
  const html = pages.filter((x) => x.ok).map((x) => x.html).join("\n");
  const emails = [...extractMailtoEmails(html), ...extractVisibleEmails(html)];
  const phones = extractPhoneNumbers(html).map(toE164).filter((x): x is string => !!x);
  const picked = pickEmail(emails, p.canonical_domain);
  const market = p.city && p.state ? null : marketFromHtml(html);
  const ident = html ? resolveBusinessName(html, null) : { name: null, source: null };
  const enrichment = { fetched_at: now(), pages: pages.map((x) => ({ url: x.finalUrl, ok: x.ok, status: x.status })), emails: Array.from(new Set(emails)).slice(0, 10), phones: Array.from(new Set(phones)).slice(0, 5), name_on_site: ident.name, market_on_site: market };
  const found = !!(picked || phones.length || market);
  const patch: Record<string, unknown> = { enrichment, enriched_at: now(), updated_at: now(), status: found ? "enriched" : p.status };
  if (picked && !p.email) { patch.email = picked.email; patch.email_source = extractMailtoEmails(html).includes(picked.email) ? "mailto" : "visible"; }
  if (!p.phone_e164 && phones[0]) patch.phone_e164 = phones[0];
  if (market && !p.city) { const [city, state] = market.split(", "); patch.city = city; patch.state = state; }
  const { data: updated } = await service.from("outbound_prospects").update(patch).eq("id", p.id).select("*").single();
  const tx = await chargeAction(service, { businessId: p.business_id, actionKey: "outbound.prospect_enriched", outcome: found ? "completed" : "failed", description: `Prospect enriched — ${p.name}${found ? "" : " (nothing public found, 0 credits)"}`, idempotencyKey: `outbound:${p.id}:enrich:${enrichment.fetched_at}`, actorId: actor.kind === "user" ? actor.id : null, resultRef: p.id });
  await event(service, { businessId: p.business_id, prospectId: p.id, kind: "enriched", actor, payload: { found, email: patch.email ?? p.email ?? null, credit_tx: tx.id } });
  return { prospect: updated, found };
}

// ---------- 2. write (charges outbound.message_written) → pending_approval ----------
async function senderVars(service: SupabaseClient, b: Awaited<ReturnType<typeof business>>): Promise<Pick<TemplateVars, "sender_name" | "sender_company" | "sender_category" | "offer_line">> {
  const { data: owner } = await service.from("users").select("full_name, email").eq("id", b.owner_id).maybeSingle();
  return { sender_name: (owner?.full_name as string) || (owner?.email as string) || b.legal_name, sender_company: b.legal_name, sender_category: b.primary_category, offer_line: b.outbound_offer_line };
}

export async function draftMessage(service: SupabaseClient, input: { prospectId: string; template: TemplateKey; custom?: { subject: string; body: string } | null; sequenceId?: string | null; step?: number; slots?: string | null; bookingTime?: string | null; meetUrl?: string | null; inReplyTo?: string | null }, actor: Actor) {
  const { data: p } = await service.from("outbound_prospects").select("*").eq("id", input.prospectId).maybeSingle();
  if (!p) throw new OutboundError("not_found", "Prospect not found.", 404);
  const b = await business(service, p.business_id);
  await guard(service, b.id);
  if (!p.email) throw new OutboundError("no_email", "No email on file for this prospect — enrich it first or add one.");
  const { data: sup } = await service.from("outbound_suppressions").select("id").eq("business_id", b.id).eq("email", p.email.toLowerCase()).maybeSingle();
  if (sup) throw new OutboundError("suppressed", "This address unsubscribed or bounced — the agent won't write to it.");
  const vars: TemplateVars = { company: p.name, contact_name: p.contact_name, city: p.city, category: p.category, years_in_business: yearsFromCustom(p.custom_fields as Record<string, unknown> | null), ...(await senderVars(service, b)), slots: input.slots ?? null, booking_time: input.bookingTime ?? null, meet_url: input.meetUrl ?? null };
  // Source: a system preset, the business's saved preset ("saved:<id>") or the customer's own email ("custom"). Stored in variable form so it can be saved as a preset later.
  const src = await resolveSource(service, b.id, input.template, input.custom ?? null);
  let rendered: { subject: string; body: string };
  try { rendered = renderSource(src, vars); } catch (e) { throw new OutboundError("missing_facts", e instanceof Error ? e.message : "Missing facts."); }
  const { data: m, error } = await service.from("outbound_messages").insert({ business_id: b.id, prospect_id: p.id, sequence_id: input.sequenceId ?? null, step: input.step ?? 0, direction: "out", to_email: p.email, subject: rendered.subject, body_text: rendered.body, template_key: src.label, template_source: { subject: src.subject, body: src.body, label: src.label }, status: "pending_approval", approval_requested_at: now(), in_reply_to: input.inReplyTo ?? null, created_by: actor.label }).select("*").single();
  if (error) throw new Error(error.message);
  const tx = await chargeAction(service, { businessId: b.id, actionKey: "outbound.message_written", outcome: "completed", description: `Message written — ${p.name} (${input.template})`, idempotencyKey: `outbound:${m.id}:write`, actorId: actor.kind === "user" ? actor.id : null, resultRef: m.id });
  await service.from("outbound_messages").update({ credit_tx_id: tx.id }).eq("id", m.id);
  await event(service, { businessId: b.id, prospectId: p.id, messageId: m.id, kind: "approval_requested", actor, payload: { template: src.label, credit_tx: tx.id } });
  // Owners (and the assigned overseer): something is waiting for a human. SMS is coalesced to one per 10 minutes per person.
  const { data: ownerRows } = await service.from("users").select("id").eq("team_role", "owner");
  const ids = Array.from(new Set([...(ownerRows ?? []).map((r) => r.id as string), ...(b.agent_overseer_id ? [b.agent_overseer_id] : [])]));
  await alertOwners(service, {
    trigger: "approval_pending", userIds: ids,
    sms: `Approval needed: ${b.legal_name} -> ${p.name} (${src.label}). Review at sfbconnect.com/team/outbound`,
    email: { subject: `Approval needed: ${b.legal_name} → ${p.name}`, html: `<p>An outbound draft for <strong>${p.name}</strong> (${b.legal_name}, template ${src.label}) is waiting for approval.</p><p><a href="https://www.sfbconnect.com/team/outbound">Open the approval queue</a></p>`, text: `An outbound draft for ${p.name} (${b.legal_name}, ${src.label}) is waiting for approval: https://www.sfbconnect.com/team/outbound` },
    inApp: { type: "approval_pending", title: `Approval needed: ${p.name}`, body: `${b.legal_name} · ${src.label}`, actionUrl: "/team/outbound", actionLabel: "Review" },
    detail: { message_id: m.id, business_id: b.id },
  });
  return m;
}

/** The intro this business uses: its explicit pick, else the deterministic recommendation (people-list / consumer ICP → consumer intro). */
export async function introTemplateFor(service: SupabaseClient, b: { id: string; outbound_intro_template: string | null; icp: { industries?: string[]; notes?: string | null } | null }): Promise<{ key: string; picked: boolean; reason: string }> {
  if (b.outbound_intro_template) return { key: b.outbound_intro_template, picked: true, reason: "Chosen by you." };
  const { data: prospects } = await service.from("outbound_prospects").select("name, contact_name, website, source").eq("business_id", b.id).in("status", ["sourced", "enriched"]).limit(200);
  const r = recommendIntro((prospects ?? []) as { source?: string | null; website?: string | null; contact_name?: string | null; name: string }[], b.icp);
  return { key: r.key, picked: false, reason: r.reason };
}

/** Start the default sequence: drafts step 0 now (the chosen intro, or a one-off override such as a custom email); later steps are drafted by the cron when due (each one needs its own approval). */
export async function startSequence(service: SupabaseClient, prospectId: string, actor: Actor, override?: { template: string; custom?: { subject: string; body: string } | null } | null) {
  const { data: p } = await service.from("outbound_prospects").select("id, business_id").eq("id", prospectId).maybeSingle();
  if (!p) throw new OutboundError("not_found", "Prospect not found.", 404);
  let { data: seq } = await service.from("outbound_sequences").select("id").eq("business_id", p.business_id).eq("name", "Default 3-step").maybeSingle();
  if (!seq) { const ins = await service.from("outbound_sequences").insert({ business_id: p.business_id, name: "Default 3-step", steps: DEFAULT_SEQUENCE_STEPS }).select("id").single(); seq = ins.data; }
  const intro = override ?? { template: (await introTemplateFor(service, await business(service, p.business_id))).key, custom: null };
  const m = await draftMessage(service, { prospectId, template: intro.template, custom: intro.custom ?? null, sequenceId: seq!.id, step: 0 }, actor);
  await service.from("outbound_prospects").update({ status: "in_sequence", updated_at: now() }).eq("id", prospectId);
  return m;
}

// ---------- 3. approval (human only; approve charges human.review_pass) ----------
export async function approveMessage(service: SupabaseClient, messageId: string, approver: { id: string; label: string }, opts: { andSend?: boolean; note?: string } = {}) {
  const { data: m } = await service.from("outbound_messages").select("*").eq("id", messageId).maybeSingle();
  if (!m) throw new OutboundError("not_found", "Message not found.", 404);
  if (m.status !== "pending_approval") throw new OutboundError("not_pending", `Message is ${m.status}, not pending approval.`);
  const b = await business(service, m.business_id);
  const { data: u } = await service.from("users").select("team_role").eq("id", approver.id).maybeSingle();
  const allowed = u?.team_role === "owner" || b.owner_id === approver.id || b.agent_overseer_id === approver.id;
  if (!allowed) throw new OutboundError("forbidden", "Only the business owner, its overseer, or a team owner can approve.", 403);
  const { data: updated } = await service.from("outbound_messages").update({ status: "approved", approved_by: approver.id, approved_at: now(), updated_at: now() }).eq("id", m.id).eq("status", "pending_approval").select("*").maybeSingle();
  if (!updated) throw new OutboundError("race", "Message was changed by someone else — reload.", 409);
  const tx = await chargeAction(service, { businessId: b.id, actionKey: "human.review_pass", outcome: "completed", description: `Human review pass — approved message to ${m.to_email}`, idempotencyKey: `outbound:${m.id}:approve`, actorId: approver.id, resultRef: m.id, approvedBy: approver.id });
  await event(service, { businessId: b.id, prospectId: m.prospect_id, messageId: m.id, kind: "approved", actor: { kind: "user", id: approver.id, label: approver.label }, payload: { note: opts.note ?? null, credit_tx: tx.id } });
  if (opts.andSend) return sendApprovedMessage(service, m.id, { kind: "user", id: approver.id, label: approver.label });
  return updated;
}

export async function rejectMessage(service: SupabaseClient, messageId: string, approver: { id: string; label: string }, reason: string) {
  const { data: m } = await service.from("outbound_messages").update({ status: "rejected", rejected_reason: reason.slice(0, 500), approved_by: null, approved_at: null, updated_at: now() }).eq("id", messageId).eq("status", "pending_approval").select("*").maybeSingle();
  if (!m) throw new OutboundError("not_pending", "Only pending messages can be rejected.");
  await event(service, { businessId: m.business_id, prospectId: m.prospect_id, messageId: m.id, kind: "rejected", actor: { kind: "user", id: approver.id, label: approver.label }, payload: { reason } });
  return m;
}

/** A send that failed after a human approved it (e.g. Gmail API not enabled yet) may be retried: the approval stays on the row, the gate still applies. */
export async function retryFailedSend(service: SupabaseClient, messageId: string, actor: Actor) {
  const { data: m } = await service.from("outbound_messages").update({ status: "approved", error: null, updated_at: now() }).eq("id", messageId).eq("status", "failed").not("approved_by", "is", null).not("approved_at", "is", null).select("id").maybeSingle();
  if (!m) throw new OutboundError("not_retryable", "Only a failed message that a human already approved can be retried.");
  return sendApprovedMessage(service, messageId, actor);
}

// ---------- 4. send (gate enforced; sends are free) ----------
export async function sendApprovedMessage(service: SupabaseClient, messageId: string, actor: Actor) {
  const { data: m } = await service.from("outbound_messages").select("*").eq("id", messageId).maybeSingle();
  if (!m) throw new OutboundError("not_found", "Message not found.", 404);
  const b = await business(service, m.business_id);
  const { data: sup } = m.to_email ? await service.from("outbound_suppressions").select("id").eq("business_id", b.id).eq("email", String(m.to_email).toLowerCase()).maybeSingle() : { data: null };
  const gate = canSend({ id: m.id, status: m.status as MessageStatus, approved_by: m.approved_by, approved_at: m.approved_at, to_email: m.to_email, direction: m.direction }, !!sup);
  if (!gate.ok) throw new OutboundError(`gate_${gate.reason}`, `Refused to send: ${gate.reason}.`, 409);
  // Send window: before the campaign's window opens, an approved email is held (stays "approved") and the hourly sync sends it inside the window.
  const win = sendWindowState(m.template_key as string | null, new Date());
  if (win.state === "before") {
    await event(service, { businessId: b.id, prospectId: m.prospect_id, messageId: m.id, kind: "send_held", actor, payload: { window: win.window.id, opens_at: win.window.startISO, label: win.window.label } });
    return { ...m, held_until: win.window.startISO, held_label: win.window.label };
  }
  await guard(service, b.id);
  const origin = appOrigin();
  const unsub = `${origin}/api/outbound/unsubscribe/${m.id}/${unsubscribeToken(m.id, b.id, secret())}`;
  const text = `${m.body_text}${unsubscribeFooter(unsub)}`;
  const html = `<div style="font-family:Inter,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#111">${m.body_text.split("\n").map((l: string) => (l.trim() ? `<p style="margin:0 0 12px">${escapeHtml(l)}</p>` : "")).join("")}<p style="margin:24px 0 0;font-size:12px;color:#777">If you'd rather not hear from us, one click and you won't: <a href="${unsub}">unsubscribe</a></p><img src="${origin}/api/outbound/o/${m.id}.gif" width="1" height="1" alt="" /></div>`;

  try {
    const res = await sendGmail(b.owner_id, { to: m.to_email, subject: m.subject, text, html, threadId: m.gmail_thread_id ?? undefined, inReplyTo: m.in_reply_to ? (await service.from("outbound_messages").select("gmail_message_id").eq("id", m.in_reply_to).maybeSingle()).data?.gmail_message_id ?? undefined : undefined });
    const { data: sent } = await service.from("outbound_messages").update({ status: "sent", sent_at: now(), gmail_message_id: res.id, gmail_thread_id: res.threadId, updated_at: now() }).eq("id", m.id).select("*").single();
    await service.from("outbound_prospects").update({ last_contacted_at: now(), updated_at: now() }).eq("id", m.prospect_id);
    await event(service, { businessId: b.id, prospectId: m.prospect_id, messageId: m.id, kind: "sent", actor, payload: { to: m.to_email, gmail_id: res.id } });
    return sent;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "send failed";
    await service.from("outbound_messages").update({ status: "failed", error: msg.slice(0, 500), updated_at: now() }).eq("id", m.id);
    await event(service, { businessId: b.id, prospectId: m.prospect_id, messageId: m.id, kind: "failed", actor, payload: { error: msg.slice(0, 200) } });
    throw new OutboundError("send_failed", /not connected/i.test(msg) ? "Gmail isn't connected for this business's owner — connect it in Integrations." : `Gmail refused the send: ${msg}`, 502);
  }
}
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

// ---------- 5. track ----------
export async function recordOpen(service: SupabaseClient, messageId: string) {
  const { data: m } = await service.from("outbound_messages").select("id, business_id, prospect_id, open_count, opened_at, status").eq("id", messageId).maybeSingle();
  if (!m || m.status !== "sent") return;
  await service.from("outbound_messages").update({ opened_at: m.opened_at ?? now(), open_count: (m.open_count ?? 0) + 1 }).eq("id", m.id);
  if (!m.opened_at) await event(service, { businessId: m.business_id, prospectId: m.prospect_id, messageId: m.id, kind: "opened", actor: { kind: "system", id: null, label: "pixel" } });
}

export async function unsubscribe(service: SupabaseClient, messageId: string, token: string): Promise<boolean> {
  const { data: m } = await service.from("outbound_messages").select("id, business_id, prospect_id, to_email").eq("id", messageId).maybeSingle();
  if (!m || unsubscribeToken(m.id, m.business_id, secret()) !== token) return false;
  await service.from("outbound_suppressions").upsert({ business_id: m.business_id, email: String(m.to_email).toLowerCase(), reason: "unsubscribed" }, { onConflict: "business_id,email" });
  await service.from("outbound_prospects").update({ status: "unsubscribed", updated_at: now() }).eq("id", m.prospect_id);
  await service.from("outbound_messages").update({ status: "rejected", rejected_reason: "recipient unsubscribed", updated_at: now() }).eq("prospect_id", m.prospect_id).in("status", ["draft", "pending_approval", "approved"]);
  await event(service, { businessId: m.business_id, prospectId: m.prospect_id, messageId: m.id, kind: "unsubscribed", actor: { kind: "system", id: null, label: "recipient" } });
  return true;
}

/** Replies: for every sent message with a Gmail thread, look for newer messages in that thread not from the owner. */
export async function syncReplies(service: SupabaseClient, businessId: string): Promise<{ checked: number; replies: number }> {
  const b = await business(service, businessId);
  const { data: sent } = await service.from("outbound_messages").select("id, prospect_id, to_email, gmail_thread_id, gmail_message_id, replied_at, sent_at").eq("business_id", businessId).eq("status", "sent").not("gmail_thread_id", "is", null).is("replied_at", null).order("sent_at", { ascending: false }).limit(50);
  let replies = 0;
  const pids = Array.from(new Set((sent ?? []).map((m) => m.prospect_id as string)));
  const { data: prows } = pids.length ? await service.from("outbound_prospects").select("id, canonical_domain").in("id", pids) : { data: [] as { id: string; canonical_domain: string | null }[] };
  const domainOf = new Map((prows ?? []).map((p) => [p.id as string, p.canonical_domain as string | null]));
  for (const m of sent ?? []) {
    let inbox: Awaited<ReturnType<typeof listGmailMessages>> = [];
    try { inbox = await listGmailMessages(b.owner_id, { q: `from:${m.to_email} newer_than:30d`, max: 5 }); } catch { continue; }
    let reply = inbox.find((x) => x.threadId === m.gmail_thread_id && x.id !== m.gmail_message_id);
    let match: "thread" | "domain" = "thread";
    // G7 (2026-10-12): a reply from a colleague or a fresh thread used to be missed. Second pass: anything from the prospect's own domain after our send (never for free-mail domains).
    if (!reply) {
      const dom = domainOf.get(m.prospect_id as string);
      if (dom && !isFreemailDomain(dom)) {
        const sentAt = (m as { sent_at?: string | null }).sent_at ? new Date((m as { sent_at: string }).sent_at) : null;
        const after = sentAt ? `${sentAt.getUTCFullYear()}/${String(sentAt.getUTCMonth() + 1).padStart(2, "0")}/${String(sentAt.getUTCDate()).padStart(2, "0")}` : null;
        try { const byDomain = await listGmailMessages(b.owner_id, { q: `from:${dom}${after ? ` after:${after}` : " newer_than:30d"}`, max: 5 }); reply = byDomain.find((x) => x.id !== m.gmail_message_id && x.from.toLowerCase().includes(`@${dom}`)); if (reply) match = "domain"; } catch { /* keep thread result */ }
      }
    }
    if (!reply) continue;
    let text = reply.snippet;
    try { text = (await getGmailMessage(b.owner_id, reply.id)).text || reply.snippet; } catch { /* snippet is fine */ }
    const { data: existing } = await service.from("outbound_messages").select("id").eq("gmail_message_id", reply.id).maybeSingle();
    if (!existing) {
      await service.from("outbound_messages").insert({ business_id: businessId, prospect_id: m.prospect_id, direction: "in", status: "received", to_email: null, subject: reply.subject, body_text: text.slice(0, 20_000), gmail_message_id: reply.id, gmail_thread_id: reply.threadId, in_reply_to: m.id, created_by: "gmail" });
    }
    await service.from("outbound_messages").update({ replied_at: now(), updated_at: now() }).eq("id", m.id);
    await service.from("outbound_prospects").update({ status: "replied", updated_at: now() }).eq("id", m.prospect_id);
    await event(service, { businessId, prospectId: m.prospect_id, messageId: m.id, kind: "replied", actor: { kind: "system", id: null, label: "gmail-sync" }, payload: { from: reply.from, snippet: reply.snippet.slice(0, 200), match } });
    replies++;
  }
  return { checked: (sent ?? []).length, replies };
}

/** Sequence advance: for prospects in an active sequence, draft the next due step (→ pending approval). Stops on reply/unsubscribe. */
export async function advanceSequences(service: SupabaseClient, businessId: string, actor: Actor): Promise<{ drafted: number }> {
  const { data: prospects } = await service.from("outbound_prospects").select("id").eq("business_id", businessId).eq("status", "in_sequence");
  let drafted = 0;
  const introKey = (prospects ?? []).length ? (await introTemplateFor(service, await business(service, businessId))).key : "intro";
  for (const p of prospects ?? []) {
    const { data: msgs } = await service.from("outbound_messages").select("sequence_id, step, status, sent_at, created_at").eq("prospect_id", p.id).eq("direction", "out").not("sequence_id", "is", null).order("created_at");
    if (!msgs?.length) continue;
    const seqId = msgs[0].sequence_id; const { data: seq } = await service.from("outbound_sequences").select("steps, status").eq("id", seqId).maybeSingle();
    if (!seq || seq.status !== "active") continue;
    const first = msgs.find((x) => x.status === "sent" || x.status === "simulated"); if (!first?.sent_at) continue; // sequence clock starts at the first real send
    const consumed = msgs.map((x) => x.step); // any drafted/sent/rejected step counts as consumed
    const due = dueSteps(seq.steps as { day: number; template: string }[], new Date(first.sent_at), consumed);
    for (const i of due) {
      const step = (seq.steps as { day: number; template: TemplateKey }[])[i];
      try { await draftMessage(service, { prospectId: p.id, template: resolveStepTemplate(step.template, introKey), sequenceId: seqId, step: i }, actor); drafted++; }
      catch (e) { if (!(e instanceof OutboundError)) throw e; /* no credits / suppressed → skip, surfaced in events */ }
    }
  }
  return { drafted };
}

// ---------- 6. book (charges outbound.meeting_booked; confirmation email → pending approval) ----------
export async function proposeMeetingSlots(service: SupabaseClient, businessId: string, opts: { days?: number; minutes?: number; count?: number } = {}) {
  const b = await business(service, businessId);
  const from = new Date(); const to = new Date(from.getTime() + (opts.days ?? 7) * 86_400_000);
  let busy: { start: string; end: string }[] = [];
  try { busy = await getBusyBlocks(b.owner_id, from.toISOString(), to.toISOString()); } catch (e) { throw new OutboundError("calendar_not_connected", "Google Calendar isn't connected for this business's owner.", 409); }
  const tzOffset = tzOffsetMinutes(b.outbound_time_zone, from);
  return { slots: proposeSlots(busy, { from, days: opts.days ?? 7, minutes: opts.minutes ?? 15, tzOffsetMinutes: tzOffset, count: opts.count ?? 3 }), timeZone: b.outbound_time_zone };
}

export async function bookMeeting(service: SupabaseClient, input: { prospectId: string; startISO: string; endISO: string; replyToMessageId?: string | null }, actor: Actor) {
  const { data: p } = await service.from("outbound_prospects").select("*").eq("id", input.prospectId).maybeSingle();
  if (!p) throw new OutboundError("not_found", "Prospect not found.", 404);
  const b = await business(service, p.business_id);
  await guard(service, b.id);
  let eventRes: { eventId: string; htmlLink: string; meetUrl: string | null } | null = null;
  {
    try { eventRes = await createCalendarEvent(b.owner_id, { summary: `${b.legal_name} × ${p.name}`, description: `Booked by your SFB Agent. Prospect: ${p.name}${p.email ? ` <${p.email}>` : ""}${p.website ? ` · ${p.website}` : ""}`, startISO: input.startISO, endISO: input.endISO, timeZone: b.outbound_time_zone }); }
    catch (e) { throw new OutboundError("calendar_failed", e instanceof Error ? e.message : "Calendar refused the event.", 502); }
  }
  const { data: booking, error } = await service.from("outbound_bookings").insert({ business_id: b.id, prospect_id: p.id, message_id: input.replyToMessageId ?? null, calendar_owner_id: b.owner_id, calendar_event_id: eventRes?.eventId ?? null, meet_url: eventRes?.meetUrl ?? null, start_at: input.startISO, end_at: input.endISO, time_zone: b.outbound_time_zone, created_by: actor.label }).select("*").single();
  if (error) throw new Error(error.message);
  const tx = await chargeAction(service, { businessId: b.id, actionKey: "outbound.meeting_booked", outcome: "completed", description: `Meeting booked — ${p.name}`, idempotencyKey: `outbound:booking:${booking.id}`, actorId: actor.kind === "user" ? actor.id : null, resultRef: booking.id });
  await service.from("outbound_bookings").update({ credit_tx_id: tx.id }).eq("id", booking.id);
  await service.from("outbound_prospects").update({ status: "booked", updated_at: now() }).eq("id", p.id);
  await event(service, { businessId: b.id, prospectId: p.id, kind: "booked", actor, payload: { booking_id: booking.id, start: input.startISO, meet: eventRes?.meetUrl ?? null, credit_tx: tx.id } });
  // Confirmation goes through the same gate as everything else: drafted, pending approval.
  let confirmation = null;
  if (p.email) {
    const when = new Date(input.startISO).toLocaleString("en-US", { timeZone: b.outbound_time_zone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
    try { confirmation = await draftMessage(service, { prospectId: p.id, template: "booking_confirmation", bookingTime: when, meetUrl: eventRes?.meetUrl ?? null, inReplyTo: input.replyToMessageId ?? null }, actor); } catch (e) { if (!(e instanceof OutboundError)) throw e; }
  }
  return { booking, event: eventRes, confirmation };
}

function tzOffsetMinutes(tz: string, at: Date): number {
  try { const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" }).formatToParts(at); const off = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+0"; const m = off.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/); if (!m) return 0; const sign = m[1] === "-" ? -1 : 1; return sign * (parseInt(m[2], 10) * 60 + (m[3] ? parseInt(m[3], 10) : 0)); } catch { return 0; }
}

// ---------- cron entry ----------
/** Send window release: while a window is open, send this business's approved, held emails for that window's templates (oldest approval first, capped per tick). */
export async function releaseSendWindow(service: SupabaseClient, businessId: string, nowDate = new Date()): Promise<{ released: number; failed: number }> {
  const keys = openWindowTemplateKeys(nowDate);
  if (!keys.length) return { released: 0, failed: 0 };
  const { data: queued } = await service.from("outbound_messages").select("id").eq("business_id", businessId).eq("status", "approved").eq("direction", "out").in("template_key", keys).not("approved_by", "is", null).order("approved_at", { ascending: true }).limit(RELEASE_CAP_PER_TICK);
  let released = 0, failed = 0;
  for (const m of queued ?? []) {
    try { const r = await sendApprovedMessage(service, m.id as string, { kind: "system", id: null, label: "send-window" }); if ((r as { status?: string })?.status === "sent") released++; } catch { failed++; }
  }
  return { released, failed };
}

/** G6: retry human-approved sends that failed ≥ 1 h ago while the owner's Gmail connection is active. Cap 20 per business per run. */
export async function retryFailedSends(service: SupabaseClient, businessId: string, nowDate = new Date()): Promise<{ retried: number; recovered: number }> {
  const b = await business(service, businessId);
  const { data: conn } = await service.from("integration_connections").select("status").eq("provider", "gmail").eq("owner_id", b.owner_id).maybeSingle();
  if (conn?.status !== "active") return { retried: 0, recovered: 0 };
  const { data: failed } = await service.from("outbound_messages").select("id, status, approved_by, approved_at, updated_at, created_at").eq("business_id", businessId).eq("status", "failed").order("updated_at", { ascending: true }).limit(20);
  let retried = 0, recovered = 0;
  for (const m of failed ?? []) {
    if (!retryEligible(m as { status: string; approved_by: string | null; approved_at: string | null; updated_at: string; created_at: string }, nowDate)) continue;
    retried++;
    try { const r = await retryFailedSend(service, m.id as string, { kind: "system", id: null, label: "cron-retry" }); if (r?.status === "sent") recovered++; } catch { /* stays failed; the row's error is updated by sendApprovedMessage */ }
  }
  return { retried, recovered };
}

/** G10: one reminder per draft that has waited ≥ 24 h, bundled per business into a single owner alert. */
export async function remindPendingApprovals(service: SupabaseClient, businessId: string, nowDate = new Date()): Promise<number> {
  const b = await business(service, businessId);
  const { data: pending } = await service.from("outbound_messages").select("id, approval_requested_at, prospect_id").eq("business_id", businessId).eq("status", "pending_approval");
  const due = (pending ?? []).filter((m) => reminderDue(m.approval_requested_at as string | null, nowDate));
  if (!due.length) return 0;
  const { data: already } = await service.from("outbound_events").select("message_id").eq("business_id", businessId).eq("kind", "approval_reminder").in("message_id", due.map((m) => m.id as string));
  const done = new Set((already ?? []).map((e) => e.message_id as string));
  const fresh = due.filter((m) => !done.has(m.id as string));
  if (!fresh.length) return 0;
  const { data: ownerRows } = await service.from("users").select("id").eq("team_role", "owner");
  const ids = Array.from(new Set([...(ownerRows ?? []).map((r) => r.id as string), ...(b.agent_overseer_id ? [b.agent_overseer_id] : [])]));
  const total = (pending ?? []).length;
  await alertOwners(service, {
    trigger: "approval_pending", userIds: ids,
    sms: `Still waiting: ${total} draft${total === 1 ? "" : "s"} for ${b.legal_name} have sat 24h+ in the approval queue. sfbconnect.com/team/outbound`,
    email: { subject: `Still waiting: ${total} draft${total === 1 ? "" : "s"} for ${b.legal_name}`, html: `<p><strong>${total}</strong> outbound draft${total === 1 ? "" : "s"} for ${b.legal_name} ${total === 1 ? "has" : "have"} been waiting more than 24 hours. Nothing sends until someone approves.</p><p><a href="https://www.sfbconnect.com/team/outbound">Open the approval queue</a></p>`, text: `${total} drafts for ${b.legal_name} have waited 24h+ for approval: https://www.sfbconnect.com/team/outbound` },
    inApp: { type: "approval_pending", title: `Still waiting: ${total} draft${total === 1 ? "" : "s"} (${b.legal_name})`, body: "24h+ in the approval queue", actionUrl: "/team/outbound", actionLabel: "Review" },
    detail: { business_id: b.id, message_ids: fresh.map((m) => m.id) },
  });
  for (const m of fresh) await event(service, { businessId, prospectId: m.prospect_id as string, messageId: m.id as string, kind: "approval_reminder", actor: { kind: "system", id: null, label: "cron" }, payload: { waited_hours: Math.floor((nowDate.getTime() - new Date(m.approval_requested_at as string).getTime()) / 3600e3) } });
  return fresh.length;
}

/** G9: probe the owner's Gmail + Calendar tokens; alert (once, on the transition to dead) and tell the business owner how to fix it. */
export async function probeConnections(service: SupabaseClient, businessId: string): Promise<{ gmail: "ok" | "dead" | "none"; calendar: "ok" | "dead" | "none"; alerted: boolean }> {
  const b = await business(service, businessId);
  const res = { gmail: "none" as "ok" | "dead" | "none", calendar: "none" as "ok" | "dead" | "none", alerted: false };
  const dead: string[] = [];
  const { data: g } = await service.from("integration_connections").select("status").eq("provider", "gmail").eq("owner_id", b.owner_id).maybeSingle();
  if (g) { try { await getAccessToken("gmail", b.owner_id); res.gmail = "ok"; } catch { res.gmail = "dead"; if (g.status !== "error") dead.push("Gmail"); } }
  const { data: c } = await service.from("crm_calendar_connections").select("refresh_failed_at").eq("rep_id", b.owner_id).maybeSingle();
  if (c) { try { await probeCalendarConnection(b.owner_id); res.calendar = "ok"; } catch { res.calendar = "dead"; if (!c.refresh_failed_at) dead.push("Google Calendar"); } }
  if (dead.length) {
    res.alerted = true;
    const what = dead.join(" and ");
    await alertOwners(service, {
      trigger: "system_health",
      sms: `${b.legal_name}: ${what} connection died (token refresh refused). Sends/bookings will fail until they reconnect in Integrations.`,
      email: { subject: `${what} connection died — ${b.legal_name}`, html: `<p>Google refused to refresh the <strong>${what}</strong> token for <strong>${b.legal_name}</strong>. Their sends/bookings will fail until they reconnect in Integrations. The customer has been emailed.</p>`, text: `${what} connection died for ${b.legal_name}. Customer emailed to reconnect.` },
      inApp: { type: "system", title: `${what} connection died: ${b.legal_name}`, body: "Customer emailed to reconnect", actionUrl: "/team/integrations", actionLabel: "Integrations" },
      detail: { business_id: b.id, dead },
    });
    const { data: owner } = await service.from("users").select("email").eq("id", b.owner_id).maybeSingle();
    if (owner?.email) void sendEmail({ to: owner.email as string, subject: `Your ${what} connection needs attention`, html: `<p>Google stopped accepting our access to your <strong>${what}</strong>. Nothing is lost — your agent just can't send or book until it's reconnected.</p><p><a href="https://www.sfbconnect.com/dashboard/integrations">Reconnect in Integrations</a> (one click, same account).</p>`, text: `Google stopped accepting our access to your ${what}. Reconnect at https://www.sfbconnect.com/dashboard/integrations` });
  }
  return res;
}

export async function runOutboundSync(service: SupabaseClient): Promise<{ businesses: number; replies: number; drafted: number; released: number; retried: number; recovered: number; reminders: number; deadConnections: number; alertRetries: { retried: number; recovered: number; exhausted: number }; errors: string[] }> {
  const { data: bizs } = await service.from("businesses").select("id").not("plan_key", "is", null);
  const out = { businesses: 0, replies: 0, drafted: 0, released: 0, retried: 0, recovered: 0, reminders: 0, deadConnections: 0, alertRetries: { retried: 0, recovered: 0, exhausted: 0 }, errors: [] as string[] };
  for (const b of bizs ?? []) {
    out.businesses++;
    try { const p = await probeConnections(service, b.id); if (p.alerted) out.deadConnections++; } catch (e) { out.errors.push(`${b.id}:probe:${e instanceof Error ? e.message.slice(0, 80) : "err"}`); }
    try { const r = await syncReplies(service, b.id); out.replies += r.replies; } catch (e) { out.errors.push(`${b.id}:sync:${e instanceof Error ? e.message.slice(0, 80) : "err"}`); }
    try { const a = await advanceSequences(service, b.id, { kind: "system", id: null, label: "cron" }); out.drafted += a.drafted; } catch (e) { out.errors.push(`${b.id}:advance:${e instanceof Error ? e.message.slice(0, 80) : "err"}`); }
    try { const r = await releaseSendWindow(service, b.id); out.released += r.released; if (r.failed) out.errors.push(`${b.id}:window:${r.failed} send(s) failed`); } catch (e) { out.errors.push(`${b.id}:window:${e instanceof Error ? e.message.slice(0, 80) : "err"}`); }
    try { const r = await retryFailedSends(service, b.id); out.retried += r.retried; out.recovered += r.recovered; } catch (e) { out.errors.push(`${b.id}:retry:${e instanceof Error ? e.message.slice(0, 80) : "err"}`); }
    try { out.reminders += await remindPendingApprovals(service, b.id); } catch (e) { out.errors.push(`${b.id}:remind:${e instanceof Error ? e.message.slice(0, 80) : "err"}`); }
  }
  // G5: failed owner-alert deliveries (Resend) get another go — once per tick, not per business.
  try { const r = await retryFailedDeliveries(service); out.alertRetries = { retried: r.retried, recovered: r.recovered, exhausted: r.exhausted }; } catch (e) { out.errors.push(`alerts:retry:${e instanceof Error ? e.message.slice(0, 80) : "err"}`); }
  // G12: errors used to sit silently in outbound_cron_settings.last_result. Owners now hear about them (coalesced to one text per hour).
  if (out.errors.length) {
    try {
      await alertOwners(service, {
        trigger: "system_health",
        sms: `Outbound sync: ${out.errors.length} error${out.errors.length === 1 ? "" : "s"} this run. First: ${out.errors[0].slice(0, 90)}`,
        email: { subject: `Outbound sync: ${out.errors.length} error${out.errors.length === 1 ? "" : "s"}`, html: `<p>The hourly outbound sync hit ${out.errors.length} error${out.errors.length === 1 ? "" : "s"}:</p><ul>${out.errors.slice(0, 10).map((e) => `<li>${e.replace(/</g, "&lt;")}</li>`).join("")}</ul><p>Full result: <code>outbound_cron_settings.last_result</code>.</p>`, text: `Outbound sync errors:\n${out.errors.slice(0, 10).join("\n")}` },
        inApp: { type: "system", title: `Outbound sync: ${out.errors.length} error${out.errors.length === 1 ? "" : "s"}`, body: out.errors[0].slice(0, 120), actionUrl: "/team/outbound", actionLabel: "Outbound" },
        detail: { errors: out.errors.slice(0, 20) },
      });
    } catch (e) { console.error("[outbound-sync] error alert failed:", e instanceof Error ? e.message : e); }
  }
  return out;
}

export { InsufficientCreditsError };
